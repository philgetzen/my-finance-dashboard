const { handleCors } = require('../_lib/cors');
const { getFirestore } = require('../_lib/firebase');

async function handler(req, res) {
  const db = getFirestore();

  if (req.method === 'GET') {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    try {
      const snapshot = await db.collection('user_holdings')
        .where('userId', '==', user_id)
        .get();

      const holdings = [];
      snapshot.forEach(doc => {
        holdings.push({ id: doc.id, ...doc.data() });
      });

      res.json({ holdings });
    } catch (error) {
      console.error('Error fetching manual holdings:', error);
      res.status(500).json({ error: 'Unable to fetch manual holdings' });
    }
  } else if (req.method === 'POST') {
    const { user_id, holding } = req.body;
    if (!user_id || !holding) {
      return res.status(400).json({ error: 'user_id and holding data are required' });
    }

    try {
      const docRef = await db.collection('user_holdings').add({
        ...holding,
        userId: user_id,
        source: holding.source || 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      res.json({ id: docRef.id, ...holding });
    } catch (error) {
      console.error('Error creating manual holding:', error);
      res.status(500).json({ error: 'Unable to create manual holding' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

module.exports = handleCors(handler);
