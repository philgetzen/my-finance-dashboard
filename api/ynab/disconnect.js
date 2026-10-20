const { handleCors } = require('../_lib/cors');
const { getFirestore } = require('../_lib/firebase');
const { withUser } = require('../_lib/auth');

async function handler(req, res, uid) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getFirestore();
    await db.collection('ynab_tokens').doc(uid).delete();

    console.log('Successfully disconnected YNAB for user:', uid);
    res.json({ success: true, message: 'YNAB disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting YNAB:', error);
    res.status(500).json({ error: 'Unable to disconnect YNAB' });
  }
}

module.exports = handleCors(withUser(handler));
