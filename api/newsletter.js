const { handleCors } = require('./_lib/cors');
const { getFirebaseAdmin, getFirestore } = require('./_lib/firebase');
const { generateAndSend, generatePreview } = require('../backend/services/newsletterService');

// Ensure Firebase Admin is initialized before newsletter service uses it
getFirebaseAdmin();

/**
 * Consolidated newsletter endpoint — handles cron, preview, and manual send
 * Uses ?action= query parameter for routing:
 *   GET  ?action=cron              → Vercel cron handler (finds user, generates & sends)
 *   GET  ?action=preview&user_id=  → Preview HTML without sending
 *   POST (body: {user_id, skipAI}) → Manual send trigger
 * All actions require CRON_SECRET Bearer token authentication
 */
async function handler(req, res) {
  // Validate cron secret (shared across all actions)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return res.status(500).json({ error: 'CRON_SECRET not configured' });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const action = req.query?.action || (req.method === 'POST' ? 'send' : 'cron');

  // --- CRON: GET ?action=cron ---
  if (req.method === 'GET' && action === 'cron') {
    try {
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
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error('Scheduled newsletter failed', { error: error.message });
      return res.status(500).json({ error: 'Newsletter generation failed', message: error.message });
    }
  }

  // --- PREVIEW: GET ?action=preview&user_id= ---
  if (req.method === 'GET' && action === 'preview') {
    const user_id = req.query?.user_id;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    try {
      console.log('Newsletter preview requested', { user_id });

      const html = await generatePreview(user_id);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    } catch (error) {
      console.error('Newsletter preview failed', { error: error.message });
      return res.status(500).json({ error: 'Newsletter preview failed', message: error.message });
    }
  }

  // --- SEND: POST ---
  if (req.method === 'POST') {
    const { user_id, skipAI = false } = req.body || {};

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    try {
      console.log('Manual newsletter send triggered', { user_id, skipAI });

      const result = await generateAndSend(user_id, { skipAI });

      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error('Newsletter send failed', { error: error.message });
      return res.status(500).json({ error: 'Newsletter generation failed', message: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed or invalid action' });
}

module.exports = handleCors(handler);
