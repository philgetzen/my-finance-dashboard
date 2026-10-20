const { handleCors } = require('../_lib/cors');
const { getFirestore } = require('../_lib/firebase');
const { withUser, ownerOf } = require('../_lib/auth');

async function handler(req, res, uid) {
  if (req.method !== 'PUT' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const db = getFirestore();
  const { accountId } = req.query;
  const docRef = db.collection('manual_accounts').doc(accountId);

  let snapshot;
  try {
    snapshot = await docRef.get();
  } catch (error) {
    console.error('Error loading manual account:', error);
    return res.status(500).json({ error: 'Unable to load manual account' });
  }
  if (!snapshot.exists) {
    return res.status(404).json({ error: 'Account not found' });
  }
  if (ownerOf(snapshot.data()) !== uid) {
    return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  }

  if (req.method === 'PUT') {
    const { account } = req.body || {};
    if (!account) {
      return res.status(400).json({ error: 'account data is required' });
    }

    // Ownership fields are not client-editable.
    const { userId: _userId, user_id: _legacyUserId, ...updates } = account;

    try {
      await docRef.update({
        ...updates,
        updatedAt: new Date().toISOString()
      });

      res.json({ id: accountId, ...updates });
    } catch (error) {
      console.error('Error updating manual account:', error);
      res.status(500).json({ error: 'Unable to update manual account' });
    }
  } else {
    try {
      await docRef.delete();
      res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
      console.error('Error deleting manual account:', error);
      res.status(500).json({ error: 'Unable to delete manual account' });
    }
  }
}

module.exports = handleCors(withUser(handler));
