import { useEffect, useState, useMemo, useCallback } from 'react';
import { useFinancialData } from './useFinanceData';
import { useYNABData, useInitializeYNAB } from './useYNABData';

// Combined hook that merges Plaid/Manual and YNAB data
export const useCombinedFinanceData = (userId) => {
  const [ynabAccessToken, setYnabAccessToken] = useState(() => {
    // Initialize from localStorage immediately to prevent flashing
    return localStorage.getItem('ynab_access_token');
  });
  const initializeYNAB = useInitializeYNAB();
  
  // Get Plaid/Manual data
  const plaidData = useFinancialData(userId);
  
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
    ...(plaidData.accounts || []),
    ...(plaidData.manualAccounts || []),
    ...(ynabData.accounts || [])
  ], [plaidData.accounts, plaidData.manualAccounts, ynabData.accounts]);

  const combinedTransactions = useMemo(() => [
    ...(plaidData.transactions || []),
    ...(ynabData.transactions || [])
  ], [plaidData.transactions, ynabData.transactions]);

  // Debug logging (commented out for performance)
  // console.log('Combined Finance Data:', {
  //   plaidAccounts: plaidData.accounts?.length || 0,
  //   manualAccounts: plaidData.manualAccounts?.length || 0,
  //   ynabAccounts: ynabData.accounts?.length || 0,
  //   plaidTransactions: plaidData.transactions?.length || 0,
  //   ynabTransactions: ynabData.transactions?.length || 0,
  //   ynabConnected: !!ynabAccessToken,
  //   ynabDataLoading: ynabData.isLoading,
  //   ynabDataError: ynabData.error
  // });

  const isLoading = plaidData.isLoading || (ynabAccessToken && ynabData.isLoading);
  const isError = plaidData.isError || ynabData.isError;
  const error = plaidData.error || ynabData.error;

  // Auto-refresh data every 5 minutes
  useEffect(() => {
    if (!userId) return;
    
    const interval = setInterval(() => {
      plaidData.refetch();
      if (ynabAccessToken) {
        ynabData.refetch();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [userId, ynabAccessToken, plaidData, ynabData]);

  // Manual refresh function
  const refreshData = useCallback(() => {
    plaidData.refetch();
    if (ynabAccessToken) {
      ynabData.refetch();
    }
  }, [plaidData, ynabData, ynabAccessToken]);

  return {
    // Original data separated
    plaidAccounts: plaidData.accounts || [],
    plaidTransactions: plaidData.transactions || [],
    manualAccounts: plaidData.manualAccounts || [],
    holdings: plaidData.holdings || [],
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