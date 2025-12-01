const { handleCors } = require('../_lib/cors');
const { getFirestore } = require('../_lib/firebase');

async function handler(req, res) {
  const db = getFirestore();
  const { holdingId } = req.query;

  if (req.method === 'PUT') {
    const { holding } = req.body;
    if (!holding) {
      return res.status(400).json({ error: 'holding data is required' });
    }

    try {
      await db.collection('user_holdings').doc(holdingId).update({
        ...holding,
        updatedAt: new Date().toISOString()
      });

      res.json({ id: holdingId, ...holding });
    } catch (error) {
      console.error('Error updating manual holding:', error);
      res.status(500).json({ error: 'Unable to update manual holding' });
    }
  } else if (req.method === 'DELETE') {
    try {
      await db.collection('user_holdings').doc(holdingId).delete();
      res.json({ success: true, message: 'Holding deleted successfully' });
    } catch (error) {
      console.error('Error deleting manual holding:', error);
      res.status(500).json({ error: 'Unable to delete manual holding' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

module.exports = handleCors(handler);
