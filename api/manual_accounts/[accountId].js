const { handleCors } = require('../_lib/cors');
const { getFirestore } = require('../_lib/firebase');

async function handler(req, res) {
  const db = getFirestore();
  const { accountId } = req.query;

  if (req.method === 'PUT') {
    const { account } = req.body;
    if (!account) {
      return res.status(400).json({ error: 'account data is required' });
    }

    try {
      await db.collection('manual_accounts').doc(accountId).update({
        ...account,
        updatedAt: new Date().toISOString()
      });

      res.json({ id: accountId, ...account });
    } catch (error) {
      console.error('Error updating manual account:', error);
      res.status(500).json({ error: 'Unable to update manual account' });
    }
  } else if (req.method === 'DELETE') {
    try {
      await db.collection('manual_accounts').doc(accountId).delete();
      res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
      console.error('Error deleting manual account:', error);
      res.status(500).json({ error: 'Unable to delete manual account' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

module.exports = handleCors(handler);
