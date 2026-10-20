const { handleCors } = require('../_lib/cors');
const { getFirestore } = require('../_lib/firebase');
const { withUser, ownerOf } = require('../_lib/auth');

async function handler(req, res, uid) {
  if (req.method !== 'PUT' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const db = getFirestore();
  const { holdingId } = req.query;
  const docRef = db.collection('user_holdings').doc(holdingId);

  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    return res.status(404).json({ error: 'Holding not found' });
  }
  if (ownerOf(snapshot.data()) !== uid) {
    return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  }

  if (req.method === 'PUT') {
    const { holding } = req.body || {};
    if (!holding) {
      return res.status(400).json({ error: 'holding data is required' });
    }

    // Ownership fields are not client-editable.
    const { userId: _userId, user_id: _legacyUserId, ...updates } = holding;

    try {
      await docRef.update({
        ...updates,
        updatedAt: new Date().toISOString()
      });

      res.json({ id: holdingId, ...updates });
    } catch (error) {
      console.error('Error updating manual holding:', error);
      res.status(500).json({ error: 'Unable to update manual holding' });
    }
  } else {
    try {
      await docRef.delete();
      res.json({ success: true, message: 'Holding deleted successfully' });
    } catch (error) {
      console.error('Error deleting manual holding:', error);
      res.status(500).json({ error: 'Unable to delete manual holding' });
    }
  }
}

module.exports = handleCors(withUser(handler));
