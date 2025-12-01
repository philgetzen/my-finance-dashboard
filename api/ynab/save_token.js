const { handleCors } = require('../_lib/cors');
const { getFirestore } = require('../_lib/firebase');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, access_token, refresh_token } = req.body;

  if (!user_id || !access_token) {
    return res.status(400).json({ error: 'user_id and access_token are required' });
  }

  try {
    const db = getFirestore();
    const userDocRef = db.collection('ynab_tokens').doc(user_id);

    await userDocRef.set({
      access_token,
      refresh_token,
      updated_at: new Date().toISOString()
    }, { merge: true });

    console.log('Successfully saved YNAB tokens for user:', user_id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving YNAB token:', error.message);
    res.status(500).json({ error: 'Unable to save YNAB token' });
  }
}

module.exports = handleCors(handler);
