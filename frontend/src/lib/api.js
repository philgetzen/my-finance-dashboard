const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

// Utility function for API requests with better error handling
const fetchWithErrorHandling = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error: ${response.status} - ${errorText}`);
  }
  
  return response.json();
};

// API functions
export const api = {
  // Access tokens
  getAccessTokens: async (userId) => {
    if (!userId) return { tokens: [] };
    const response = await fetchWithErrorHandling(`${API_BASE_URL}/api/access_tokens?user_id=${userId}`);
    return response;
  },

  // Plaid accounts
  getAccounts: async (accessTokens) => {
    if (!accessTokens || accessTokens.length === 0) return [];
    
    const accountPromises = accessTokens.map(token => {
      const accessToken = typeof token === 'string' ? token : token.access_token;
      return fetchWithErrorHandling(`${API_BASE_URL}/api/accounts`, {
        method: 'POST',
        body: JSON.stringify({ access_token: accessToken }),
      });
    });

    const results = await Promise.all(accountPromises);
    return results.flatMap(result => result.accounts || [])
      .reduce((acc, current) => {
        if (!acc.find(item => item.account_id === current.account_id)) {
          acc.push(current);
        }
        return acc;
      }, []);
  },

  // Plaid transactions
  getTransactions: async (accessTokens) => {
    if (!accessTokens || accessTokens.length === 0) return [];
    
    const transactionPromises = accessTokens.map(token => {
      const accessToken = typeof token === 'string' ? token : token.access_token;
      return fetchWithErrorHandling(`${API_BASE_URL}/api/transactions`, {
        method: 'POST',
        body: JSON.stringify({ access_token: accessToken }),
      });
    });

    const results = await Promise.all(transactionPromises);
    return results.flatMap(result => result.transactions || [])
      .reduce((acc, current) => {
        if (!acc.find(item => item.transaction_id === current.transaction_id)) {
          acc.push(current);
        }
        return acc;
      }, []);
  },

  // Holdings
  getHoldings: async (accessTokens) => {
    if (!accessTokens || accessTokens.length === 0) return [];
    
    const holdingsPromises = accessTokens.map(async (token) => {
      const accessToken = typeof token === 'string' ? token : token.access_token;
      try {
        return await fetchWithErrorHandling(`${API_BASE_URL}/api/holdings`, {
          method: 'POST',
          body: JSON.stringify({ access_token: accessToken }),
        });
      } catch (error) {
        // Only log unexpected errors, not 500s which are expected for accounts without holdings
        if (!error.message.includes('500')) {
          console.warn(`Failed to fetch holdings for token: ${error.message}`);
        }
        return { holdings: [] };
      }
    });

    const results = await Promise.all(holdingsPromises);
    return results.flatMap(result => result.holdings || [])
      .reduce((acc, current) => {
        if (!acc.find(item => 
          item.security_id === current.security_id && 
          item.account_id === current.account_id
        )) {
          acc.push(current);
        }
        return acc;
      }, []);
  },

  // Plaid Link
  createLinkToken: async () => {
    return fetchWithErrorHandling(`${API_BASE_URL}/api/create_link_token`, {
      method: 'POST',
    });
  },

  exchangePublicToken: async (publicToken) => {
    return fetchWithErrorHandling(`${API_BASE_URL}/api/exchange_public_token`, {
      method: 'POST',
      body: JSON.stringify({ public_token: publicToken }),
    });
  },

  saveAccessToken: async (userId, accessToken) => {
    return fetchWithErrorHandling(`${API_BASE_URL}/api/save_access_token`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, access_token: accessToken }),
    });
  },

  removePlaidAccount: async (userId, accountId) => {
    return fetchWithErrorHandling(`${API_BASE_URL}/api/remove_plaid_account`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, account_id: accountId }),
    });
  },
};