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
      },
      timeout: 15000 // 15 second timeout - accounts for Vercel cold start
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching budgets:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data,
      isTimeout: error.code === 'ECONNABORTED' || error.message?.includes('timeout')
    });

    // Provide more specific error messages
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return res.status(504).json({
        error: 'YNAB API request timed out',
        code: 'TIMEOUT',
        retryable: true
      });
    }

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'YNAB token expired or invalid',
        code: 'AUTH_EXPIRED',
        retryable: false
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'YNAB rate limit exceeded',
        code: 'RATE_LIMITED',
        retryable: true,
        retryAfter: error.response?.headers?.['retry-after'] || 60
      });
    }

    res.status(error.response?.status || 500).json({
      error: 'Unable to fetch budgets',
      details: error.response?.data?.error?.detail || error.message
    });
  }
}

module.exports = handleCors(handler);
