const { handleCors } = require('../_lib/cors');
const { YNAB_CONFIG, getAuthUrl } = require('../_lib/ynab');

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('Generating YNAB auth URL with:', {
    client_id: YNAB_CONFIG.clientId,
    redirect_uri: YNAB_CONFIG.redirectUri
  });

  if (!YNAB_CONFIG.clientId) {
    return res.status(500).json({ error: 'YNAB_CLIENT_ID not configured' });
  }

  const authUrl = getAuthUrl();
  console.log('Generated auth URL:', authUrl);

  res.json({ authUrl });
}

module.exports = handleCors(handler);
