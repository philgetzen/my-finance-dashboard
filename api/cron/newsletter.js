const { getFirestore } = require('../_lib/firebase');
const { generateAndSend } = require('../../backend/services/newsletterService');

/**
 * Vercel Cron handler for weekly newsletter generation
 * Schedule: Saturday 5 PM UTC (9 AM PST)
 * Configured in vercel.json crons
 */
async function handler(req, res) {
  // Vercel cron sends GET requests with Authorization header
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate cron secret
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET not configured');
    return res.status(500).json({ error: 'CRON_SECRET not configured' });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Find first user with YNAB tokens
    const db = getFirestore();
    const tokensSnapshot = await db.collection('ynab_tokens').limit(1).get();

    if (tokensSnapshot.empty) {
      console.warn('No users with YNAB tokens found for newsletter');
      return res.status(200).json({ message: 'No users with YNAB tokens found' });
    }

    const userId = tokensSnapshot.docs[0].id;
    console.log('Newsletter cron triggered', { userId });

    const result = await generateAndSend(userId);

    console.log('Scheduled newsletter completed', { userId, status: result.status });
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Scheduled newsletter failed', { error: error.message });
    return res.status(500).json({
      error: 'Newsletter generation failed',
      message: error.message
    });
  }
}

module.exports = handler;
