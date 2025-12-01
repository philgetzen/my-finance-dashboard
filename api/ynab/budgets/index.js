const { handleCors } = require('../../_lib/cors');
const { YNAB_CONFIG } = require('../../_lib/ynab');
const axios = require('axios');

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  try {
    const response = await axios.get(`${YNAB_CONFIG.apiBaseUrl}/budgets`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching budgets:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Unable to fetch budgets' });
  }
}

module.exports = handleCors(handler);
