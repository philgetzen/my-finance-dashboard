const { handleCors } = require('../_lib/cors');
const { getFirestore } = require('../_lib/firebase');
const { withUser } = require('../_lib/auth');
const { YNAB_CONFIG } = require('../_lib/ynab');
const axios = require('axios');

async function handler(req, res, uid) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { refresh_token } = req.body || {};

  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token is required' });
  }

  console.log('=== TOKEN REFRESH REQUEST ===');
  console.log('User ID:', uid);

  try {
    const tokenPayload = {
      client_id: YNAB_CONFIG.clientId,
      client_secret: YNAB_CONFIG.clientSecret,
      grant_type: 'refresh_token',
      refresh_token
    };

    const response = await axios.post('https://app.ynab.com/oauth/token', tokenPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 20000
    });

    const { access_token, refresh_token: new_refresh_token } = response.data;

    // Update tokens in Firestore
    const db = getFirestore();
    await db.collection('ynab_tokens').doc(uid).set({
      access_token,
      refresh_token: new_refresh_token,
      updated_at: new Date().toISOString()
    });

    console.log('Token refresh successful for user:', uid);

    return res.json({
      access_token,
      refresh_token: new_refresh_token,
      refreshed: true
    });
  } catch (error) {
    console.error('Token refresh failed:', error.message);

    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);

      // If refresh token is invalid/expired, user needs to re-authorize
      if (error.response.status === 401 || error.response.status === 400) {
        return res.status(401).json({
          error: 'Refresh token expired or invalid',
          code: 'REAUTH_REQUIRED',
          details: error.response.data
        });
      }
    }

    return res.status(500).json({
      error: 'Unable to refresh token',
      details: error.message
    });
  }
}

module.exports = handleCors(withUser(handler));
