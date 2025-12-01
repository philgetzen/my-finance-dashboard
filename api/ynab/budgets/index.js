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

  const { budgetId, resource, since_date } = req.query;

  try {
    let url;

    if (budgetId && resource) {
      // Handle /api/ynab/budgets?budgetId=xxx&resource=accounts
      const validResources = ['accounts', 'categories', 'transactions', 'months'];
      if (!validResources.includes(resource)) {
        return res.status(404).json({ error: `Invalid resource: ${resource}` });
      }

      url = `${YNAB_CONFIG.apiBaseUrl}/budgets/${budgetId}/${resource}`;
      if (resource === 'transactions' && since_date) {
        url += `?since_date=${since_date}`;
      }
    } else {
      // Handle /api/ynab/budgets (list all budgets)
      url = `${YNAB_CONFIG.apiBaseUrl}/budgets`;
    }

    const response = await axios.get(url, {
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
