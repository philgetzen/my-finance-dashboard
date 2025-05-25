import { useState, useEffect, useCallback } from 'react';

// Utility function for API requests
const fetchWithErrorHandling = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error: ${response.status} - ${errorText}`);
  }
  return response.json();
};

const usePlaidData = (user) => {
  const userId = user?.uid;
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

  const fetchAccessTokens = useCallback(async () => {
    if (!userId) throw new Error('User ID is required to fetch access tokens.');
    const response = await fetchWithErrorHandling(`${API_BASE_URL}/api/access_tokens?user_id=${userId}`);
    return response.tokens || [];
  }, [userId, API_BASE_URL]);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setAccounts([]);
      setTransactions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const accessTokens = await fetchAccessTokens();
      console.log('Access tokens:', accessTokens);

      // If no access tokens, just set empty arrays and return
      if (!accessTokens || accessTokens.length === 0) {
        setAccounts([]);
        setTransactions([]);
        setLoading(false);
        return;
      }

      // Filter out any invalid tokens and map to proper format
      const validTokens = accessTokens
        .filter(token => token && (typeof token === 'string' || token.access_token))
        .map(token => typeof token === 'string' ? token : token.access_token);

      console.log('Valid tokens:', validTokens);

      if (validTokens.length === 0) {
        setAccounts([]);
        setTransactions([]);
        setLoading(false);
        return;
      }

      const accountPromises = validTokens.map(token =>
        fetchWithErrorHandling(`${API_BASE_URL}/api/accounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: token }),
        })
      );

      const transactionPromises = validTokens.map(token =>
        fetchWithErrorHandling(`${API_BASE_URL}/api/transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: token }),
        })
      );

      const [accountsResults, transactionsResults] = await Promise.all([
        Promise.all(accountPromises),
        Promise.all(transactionPromises),
      ]);

      const combinedAccounts = accountsResults
        .flatMap(result => result.accounts || [])
        .reduce((acc, current) => {
          if (!acc.find(item => item.account_id === current.account_id)) {
            acc.push(current);
          }
          return acc;
        }, []);

      const combinedTransactions = transactionsResults
        .flatMap(result => result.transactions || [])
        .reduce((acc, current) => {
          if (!acc.find(item => item.transaction_id === current.transaction_id)) {
            acc.push(current);
          }
          return acc;
        }, []);

      setAccounts(combinedAccounts);
      setTransactions(combinedTransactions);
    } catch (err) {
      console.error('Error fetching Plaid data:', err);
      setError(err.message);
      setAccounts([]);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [userId, fetchAccessTokens, API_BASE_URL]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { accounts, transactions, loading, error, refetchData: fetchData };
};

export default usePlaidData;