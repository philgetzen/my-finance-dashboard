const { handleCors } = require('./_lib/cors');
const { getFirestore } = require('./_lib/firebase');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const db = getFirestore();
  const { user_id, csvData } = req.body;

  if (!user_id || !csvData) {
    return res.status(400).json({ error: 'user_id and csvData are required' });
  }

  try {
    const lines = csvData.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV data is too short or empty' });
    }

    const header = lines[0].split(',').map(h => h.trim());
    const expectedHeader = ['Ticker', 'Description', 'Account', 'Held', 'Price', 'Quantity', 'Amount'];
    if (JSON.stringify(header) !== JSON.stringify(expectedHeader)) {
      console.warn('CSV header does not match expected:', header);
    }

    const holdings = [];
    const disclaimerKeywords = ["This report is provided", "Brokerage related products", "Download date:"];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (disclaimerKeywords.some(keyword => line.startsWith(keyword))) {
        console.log('Skipping disclaimer line:', line);
        continue;
      }

      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/g).map(v => v.trim().replace(/^"|"$/g, ''));

      if (values.length !== expectedHeader.length) {
        console.warn(`Skipping malformed line ${i + 1}: expected ${expectedHeader.length} values, got ${values.length}. Line: "${line}"`);
        continue;
      }

      const holding = {
        userId: user_id,
        source: "AltruistCSV",
        importDate: new Date().toISOString(),
        ticker: values[0],
        description: values[1],
        accountNumber: values[2],
        heldPercentage: parseFloat(values[3].replace('%', '')) || 0,
        price: parseFloat(values[4].replace('$', '').replace(/,/g, '')) || 0,
        quantity: parseFloat(values[5].replace(/,/g, '')) || 0,
        marketValue: parseFloat(values[6].replace('$', '').replace(/,/g, '')) || 0,
      };
      holdings.push(holding);
    }

    if (holdings.length === 0) {
      return res.status(400).json({ error: 'No valid holdings data found in CSV' });
    }

    // Delete existing holdings
    const existingHoldingsQuery = db.collection('user_holdings')
      .where('userId', '==', user_id)
      .where('source', '==', 'AltruistCSV');
    const existingDocsSnapshot = await existingHoldingsQuery.get();

    const batchDelete = db.batch();
    existingDocsSnapshot.forEach(doc => {
      batchDelete.delete(doc.ref);
    });
    await batchDelete.commit();
    console.log(`Deleted ${existingDocsSnapshot.size} existing AltruistCSV holdings for user ${user_id}`);

    // Add new holdings
    const batchAdd = db.batch();
    const holdingsCollection = db.collection('user_holdings');
    holdings.forEach(holding => {
      const docRef = holdingsCollection.doc();
      batchAdd.set(docRef, holding);
    });
    await batchAdd.commit();

    res.json({ success: true, message: `${holdings.length} holdings imported successfully.` });

  } catch (error) {
    console.error('Error importing Altruist holdings:', error);
    res.status(500).json({ error: 'Failed to import holdings.' });
  }
}

module.exports = handleCors(handler);
