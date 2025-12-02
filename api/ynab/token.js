const { handleCors } = require('../_lib/cors');
const { getFirestore } = require('../_lib/firebase');
const { YNAB_CONFIG } = require('../_lib/ynab');
const axios = require('axios');

async function handler(req, res) {
  // GET - Retrieve stored token
  if (req.method === 'GET') {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    try {
      const db = getFirestore();
      const doc = await db.collection('ynab_tokens').doc(user_id).get();

      if (!doc.exists) {
        return res.json({ access_token: null, refresh_token: null });
      }

      const { access_token, refresh_token } = doc.data();
      return res.json({ access_token, refresh_token });
    } catch (error) {
      console.error('Error fetching YNAB token:', error);
      return res.status(500).json({ error: 'Unable to fetch YNAB token' });
    }
  }

  // POST - Exchange authorization code for tokens
  if (req.method === 'POST') {
    const { code } = req.body;

    console.log('=== TOKEN EXCHANGE REQUEST RECEIVED ===');
    console.log('Authorization code received:', code ? 'YES' : 'NO');

    if (!code) {
      console.error('No authorization code provided');
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    console.log('Token exchange attempt:', {
      client_id: YNAB_CONFIG.clientId,
      client_secret: YNAB_CONFIG.clientSecret ? 'SET' : 'MISSING',
      redirect_uri: YNAB_CONFIG.redirectUri,
      code: 'PROVIDED'
    });

    if (!YNAB_CONFIG.clientId || !YNAB_CONFIG.clientSecret) {
      console.error('Missing YNAB credentials');
      return res.status(500).json({ error: 'Server configuration error: Missing YNAB credentials' });
    }

    try {
      const tokenPayload = {
        client_id: YNAB_CONFIG.clientId,
        client_secret: YNAB_CONFIG.clientSecret,
        redirect_uri: YNAB_CONFIG.redirectUri,
        grant_type: 'authorization_code',
        code
      };

      console.log('Sending token request to YNAB');

      const response = await axios.post('https://app.ynab.com/oauth/token', tokenPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 20000 // 20 second timeout - accounts for Vercel cold start + YNAB API latency
      });

      console.log('YNAB token exchange successful');
      console.log('Response status:', response.status);

      const { access_token, refresh_token } = response.data;
      return res.json({ access_token, refresh_token });
    } catch (error) {
      console.error('Error exchanging YNAB code:');
      console.error('Error message:', error.message);

      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }

      return res.status(500).json({
        error: 'Unable to exchange authorization code',
        details: error.response?.data || error.message,
        status: error.response?.status
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

module.exports = handleCors(handler);
