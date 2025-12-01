const YNAB_CONFIG = {
  clientId: process.env.YNAB_CLIENT_ID,
  clientSecret: process.env.YNAB_CLIENT_SECRET,
  redirectUri: process.env.YNAB_REDIRECT_URI,
  apiBaseUrl: 'https://api.ynab.com/v1'
};

function getAuthUrl() {
  return `https://app.ynab.com/oauth/authorize?client_id=${YNAB_CONFIG.clientId}&redirect_uri=${encodeURIComponent(YNAB_CONFIG.redirectUri)}&response_type=code`;
}

module.exports = { YNAB_CONFIG, getAuthUrl };
