import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase'; // Assuming db is exported from your firebase setup
import { useFinanceData } from '../contexts/ConsolidatedDataContext';

const useInvestmentHoldings = () => {
  const { user } = useFinanceData();
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!user || !user.uid) {
      setHoldings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'user_holdings'), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const fetchedHoldings = [];
      querySnapshot.forEach((doc) => {
        fetchedHoldings.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort holdings, e.g., by ticker or description
      fetchedHoldings.sort((a, b) => {
        if (a.description < b.description) return -1;
        if (a.description > b.description) return 1;
        return 0;
      });

      setHoldings(fetchedHoldings);
    } catch (err) {
      console.error('Error fetching investment holdings:', err);
      setError(err.message);
      setHoldings([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { holdings, loading, error, refetchHoldings: fetchData };
};

export default useInvestmentHoldings;
