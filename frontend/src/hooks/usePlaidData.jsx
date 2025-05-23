import { useState, useEffect, useCallback, useContext } from 'react';
import { UserContext } from '../contexts/UserContext.jsx';

const usePlaidData = (user) => {
  const { userId } = useContext(UserContext);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [plaidData, setPlaidData] = useState(null);

  const fetchAccessTokens = async (userId) => {
    try {
      const response = await fetch(`http://localhost:5001/api/access_tokens?user_id=${userId}`);
      if (!response.ok) {
        throw new Error(`Error fetching access tokens: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Fetched access tokens:', data);
      return data;
    } catch (error) {
      console.error('Error in fetchAccessTokens:', error);
      throw error; // Rethrow to handle it in the component
    }
  };

  const fetchData = useCallback(async () => {
    if (!userId) {
      setAccounts([]);
      setTransactions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const accessTokens = await fetchAccessTokens(userId);

      if (accessTokens && accessTokens.length > 0) {
        const accountPromises = accessTokens.map(token =>
          fetch('http://localhost:5001/api/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: token.access_token }),
          }).then(res => res.json())
        );

        const transactionPromises = accessTokens.map(token =>
          fetch('http://localhost:5001/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: token.access_token }),
          }).then(res => res.json())
        );

        const accountsResults = await Promise.all(accountPromises);
        const transactionsResults = await Promise.all(transactionPromises);

        const combinedAccounts = accountsResults.flat().reduce((acc, current) => {
          if (!acc.find(item => item.account_id === current.account_id)) {
            acc.push(current);
          }
          return acc;
        }, []);

        const combinedTransactions = transactionsResults.flat().reduce((acc, current) => {
          if (!acc.find(item => item.transaction_id === current.transaction_id)) {
            acc.push(current);
          }
          return acc;
        }, []);

        setAccounts(combinedAccounts);
        setTransactions(combinedTransactions);
      } else {
        setAccounts([]);
        setTransactions([]);
      }
    } catch (err) {
      console.error("Error fetching access tokens:", err);
      setError(err.message);
      setAccounts([]);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const getAccessTokens = async () => {
      try {
        const tokens = await fetchAccessTokens(userId);
        setPlaidData(tokens);
      } catch (error) {
        console.error('Failed to fetch access tokens:', error);
        // Display error to the user if necessary
      }
    };

    getAccessTokens();
  }, [userId]);

  return { accounts, transactions, loading, error, refetchData: fetchData, plaidData };
};

export default usePlaidData;
