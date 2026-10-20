const { handleCors } = require('../_lib/cors');
const { getFirestore } = require('../_lib/firebase');
const { withUser } = require('../_lib/auth');

async function handler(req, res, uid) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { access_token, refresh_token } = req.body || {};

  if (!access_token) {
    return res.status(400).json({ error: 'access_token is required' });
  }

  try {
    const db = getFirestore();
    const userDocRef = db.collection('ynab_tokens').doc(uid);

    await userDocRef.set({
      access_token,
      refresh_token,
      updated_at: new Date().toISOString()
    }, { merge: true });

    console.log('Successfully saved YNAB tokens for user:', uid);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving YNAB token:', error.message);
    res.status(500).json({ error: 'Unable to save YNAB token' });
  }
}

module.exports = handleCors(withUser(handler));
