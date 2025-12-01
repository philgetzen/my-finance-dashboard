const { handleCors } = require('../../_lib/cors');
const { YNAB_CONFIG } = require('../../_lib/ynab');
const axios = require('axios');

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract path segments from the catch-all route
  const { path, since_date } = req.query;

  // path can be a string or array depending on how many segments
  const pathSegments = Array.isArray(path) ? path : [path];

  if (pathSegments.length !== 2) {
    return res.status(400).json({ error: 'Invalid path format. Expected: /budgets/{budgetId}/{resource}' });
  }

  const [budgetId, resource] = pathSegments;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  // Valid resources: accounts, categories, transactions, months
  const validResources = ['accounts', 'categories', 'transactions', 'months'];
  if (!validResources.includes(resource)) {
    return res.status(404).json({ error: `Invalid resource: ${resource}` });
  }

  try {
    let url = `${YNAB_CONFIG.apiBaseUrl}/budgets/${budgetId}/${resource}`;
    if (resource === 'transactions' && since_date) {
      url += `?since_date=${since_date}`;
    }

    const response = await axios.get(url, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error(`Error fetching ${resource}:`, error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: `Unable to fetch ${resource}` });
  }
}

module.exports = handleCors(handler);
