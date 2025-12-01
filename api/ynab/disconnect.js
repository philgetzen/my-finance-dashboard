const { handleCors } = require('../_lib/cors');
const { getFirestore } = require('../_lib/firebase');

async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  try {
    const db = getFirestore();
    await db.collection('ynab_tokens').doc(user_id).delete();

    console.log('Successfully disconnected YNAB for user:', user_id);
    res.json({ success: true, message: 'YNAB disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting YNAB:', error);
    res.status(500).json({ error: 'Unable to disconnect YNAB' });
  }
}

module.exports = handleCors(handler);
