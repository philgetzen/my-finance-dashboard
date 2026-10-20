const { handleCors } = require('../_lib/cors');
const { getFirestore } = require('../_lib/firebase');
const { withUser } = require('../_lib/auth');

async function handler(req, res, uid) {
  const db = getFirestore();

  if (req.method === 'GET') {
    try {
      const snapshot = await db.collection('user_holdings')
        .where('userId', '==', uid)
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
    const { holding } = req.body || {};
    if (!holding) {
      return res.status(400).json({ error: 'holding data is required' });
    }

    // Ownership fields come from the verified token, never the payload.
    const { userId: _userId, user_id: _legacyUserId, ...fields } = holding;

    try {
      const docRef = await db.collection('user_holdings').add({
        ...fields,
        userId: uid,
        source: fields.source || 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      res.json({ id: docRef.id, ...fields });
    } catch (error) {
      console.error('Error creating manual holding:', error);
      res.status(500).json({ error: 'Unable to create manual holding' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

module.exports = handleCors(withUser(handler));
