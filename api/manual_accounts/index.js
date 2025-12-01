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
      const snapshot = await db.collection('manual_accounts')
        .where('userId', '==', user_id)
        .get();

      const accounts = [];
      snapshot.forEach(doc => {
        accounts.push({ id: doc.id, ...doc.data() });
      });

      res.json({ accounts });
    } catch (error) {
      console.error('Error fetching manual accounts:', error);
      res.status(500).json({ error: 'Unable to fetch manual accounts' });
    }
  } else if (req.method === 'POST') {
    const { user_id, account } = req.body;
    if (!user_id || !account) {
      return res.status(400).json({ error: 'user_id and account data are required' });
    }

    try {
      const docRef = await db.collection('manual_accounts').add({
        ...account,
        userId: user_id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      res.json({ id: docRef.id, ...account });
    } catch (error) {
      console.error('Error creating manual account:', error);
      res.status(500).json({ error: 'Unable to create manual account' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

module.exports = handleCors(handler);
