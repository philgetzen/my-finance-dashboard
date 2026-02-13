const { handleCors } = require('../_lib/cors');
const { getFirebaseAdmin } = require('../_lib/firebase');
const { generatePreview } = require('../../backend/services/newsletterService');

// Ensure Firebase Admin is initialized before newsletter service uses it
getFirebaseAdmin();

/**
 * Newsletter preview endpoint — generates HTML without sending email
 * Replaces the Express endpoint at backend/index.js
 * Requires CRON_SECRET for authentication
 */
async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
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

  // Accept user_id from query params (GET) or body (POST)
  const user_id = req.query?.user_id || req.body?.user_id;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  try {
    console.log('Newsletter preview requested', { user_id });

    const html = await generatePreview(user_id);

    // Return as HTML for browser viewing
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Newsletter preview failed', { error: error.message });
    return res.status(500).json({
      error: 'Newsletter preview failed',
      message: error.message
    });
  }
}

module.exports = handleCors(handler);
