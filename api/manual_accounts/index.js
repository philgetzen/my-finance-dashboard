const { handleCors } = require('../_lib/cors');
const { getFirestore } = require('../_lib/firebase');
const { withUser, ownerOf } = require('../_lib/auth');

async function handler(req, res, uid) {
  const db = getFirestore();

  if (req.method === 'GET') {
    try {
      const snapshot = await db.collection('manual_accounts')
        .where('userId', '==', uid)
        .get();

      const accounts = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (ownerOf(data) === uid) {
          accounts.push({ id: doc.id, ...data });
        }
      });

      res.json({ accounts });
    } catch (error) {
      console.error('Error fetching manual accounts:', error);
      res.status(500).json({ error: 'Unable to fetch manual accounts' });
    }
  } else if (req.method === 'POST') {
    const { account } = req.body || {};
    if (!account) {
      return res.status(400).json({ error: 'account data is required' });
    }

    // Ownership fields come from the verified token, never the payload.
    const { userId: _userId, user_id: _legacyUserId, ...fields } = account;

    try {
      const docRef = await db.collection('manual_accounts').add({
        ...fields,
        userId: uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      res.json({ id: docRef.id, ...fields });
    } catch (error) {
      console.error('Error creating manual account:', error);
      res.status(500).json({ error: 'Unable to create manual account' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

module.exports = handleCors(withUser(handler));
