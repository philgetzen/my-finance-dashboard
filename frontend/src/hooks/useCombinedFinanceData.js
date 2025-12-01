import { useEffect, useState, useMemo, useCallback } from 'react';
import { useFinancialData } from './useFinanceData';
import { useYNABData, useInitializeYNAB } from './useYNABData';

// Combined hook that merges Manual accounts and YNAB data
export const useCombinedFinanceData = (userId) => {
  const [ynabAccessToken, setYnabAccessToken] = useState(() => {
    // Initialize from localStorage immediately to prevent flashing
    return localStorage.getItem('ynab_access_token');
  });
  const initializeYNAB = useInitializeYNAB();

  // Get local/manual data
  const localData = useFinancialData(userId);

  // Get YNAB data if token exists - only enable if we have both userId and token
  const ynabData = useYNABData('last-used', !!(userId && ynabAccessToken));

  useEffect(() => {
    const token = localStorage.getItem('ynab_access_token');
    if (token && !ynabAccessToken) {
      setYnabAccessToken(token);
      // Initialize YNAB service immediately
      initializeYNAB.mutate(token);
    }
  }, [userId]); // Only run when userId changes

  // Separate effect for token updates
  useEffect(() => {
    if (ynabAccessToken) {
      initializeYNAB.mutate(ynabAccessToken);
    }
  }, [ynabAccessToken]);

  // Update YNAB token
  const updateYNABToken = (token) => {
    if (token) {
      localStorage.setItem('ynab_access_token', token);
      setYnabAccessToken(token);
      initializeYNAB.mutate(token);
    } else {
      localStorage.removeItem('ynab_access_token');
      setYnabAccessToken(null);
    }
  };

  // Memoize combined data to prevent unnecessary re-renders
  const combinedAccounts = useMemo(() => [
    ...(localData.manualAccounts || []),
    ...(ynabData.accounts || [])
  ], [localData.manualAccounts, ynabData.accounts]);

  const combinedTransactions = useMemo(() => [
    ...(ynabData.transactions || [])
  ], [ynabData.transactions]);

  const isLoading = localData.isLoading || (ynabAccessToken && ynabData.isLoading);
  const isError = localData.isError || ynabData.isError;
  const error = localData.error || ynabData.error;

  // Auto-refresh data every 5 minutes
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      localData.refetch();
      if (ynabAccessToken) {
        ynabData.refetch();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [userId, ynabAccessToken, localData, ynabData]);

  // Manual refresh function
  const refreshData = useCallback(() => {
    localData.refetch();
    if (ynabAccessToken) {
      ynabData.refetch();
    }
  }, [localData, ynabData, ynabAccessToken]);

  return {
    // Original data separated
    manualAccounts: localData.manualAccounts || [],
    holdings: localData.holdings || [],
    ynabAccounts: ynabData.accounts || [],
    ynabTransactions: ynabData.transactions || [],

    // Combined data
    accounts: combinedAccounts,
    transactions: combinedTransactions,

    // YNAB specific
    ynabSummary: ynabData.summary,
    ynabBudgets: ynabData.budgets,
    ynabCategories: ynabData.categories,

    // States
    isLoading,
    isError,
    error,
    ynabConnected: !!ynabAccessToken,

    // Actions
    updateYNABToken,
    refreshData,
    refetch: refreshData,
  };
};
