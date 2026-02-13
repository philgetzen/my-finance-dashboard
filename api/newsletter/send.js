const { handleCors } = require('../_lib/cors');
const { getFirebaseAdmin } = require('../_lib/firebase');
const { generateAndSend } = require('../../backend/services/newsletterService');

// Ensure Firebase Admin is initialized before newsletter service uses it
getFirebaseAdmin();

/**
 * Manual newsletter trigger endpoint
 * Replaces the Express endpoint at backend/index.js
 * Requires CRON_SECRET for authentication
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate cron secret
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return res.status(500).json({ error: 'CRON_SECRET not configured' });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { user_id, skipAI = false } = req.body || {};

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  try {
    console.log('Manual newsletter send triggered', { user_id, skipAI });

    const result = await generateAndSend(user_id, { skipAI });

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Newsletter send failed', { error: error.message });
    return res.status(500).json({
      error: 'Newsletter generation failed',
      message: error.message
    });
  }
}

const wrapped = handleCors(handler);
wrapped.config = { maxDuration: 60 };
module.exports = wrapped;
