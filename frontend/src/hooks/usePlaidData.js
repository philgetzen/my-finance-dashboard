import { useState, useEffect, useCallback } from 'react';

const usePlaidData = (user) => {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!user) {
      setAccounts([]);
      setTransactions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const accessTokenResponse = await fetch(`http://localhost:5001/api/access_tokens?user_id=${user.uid}`);
      if (!accessTokenResponse.ok) {
        throw new Error('Failed to fetch access tokens');
      }
      const accessTokens = await accessTokenResponse.json();

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
      setError(err.message);
      setAccounts([]);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { accounts, transactions, loading, error, refetchData: fetchData, user };
};

export default usePlaidData;
