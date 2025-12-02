import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ynabService } from '../lib/ynabApi';
import { useEffect } from 'react';

// YNAB Query Keys
export const ynabQueryKeys = {
  all: ['ynab'],
  budgets: () => [...ynabQueryKeys.all, 'budgets'],
  accounts: (budgetId) => [...ynabQueryKeys.all, 'accounts', budgetId],
  transactions: (budgetId) => [...ynabQueryKeys.all, 'transactions', budgetId],
  categories: (budgetId) => [...ynabQueryKeys.all, 'categories', budgetId],
  months: (budgetId) => [...ynabQueryKeys.all, 'months', budgetId],
  summary: (budgetId) => [...ynabQueryKeys.all, 'summary', budgetId],
};

// Initialize YNAB Service
export const useInitializeYNAB = (accessToken, refreshToken = null, userId = null) => {
  useEffect(() => {
    if (accessToken) {
      console.log('Initializing YNAB service with token:', accessToken.substring(0, 10) + '...');
      ynabService.init(accessToken, refreshToken, userId);
      console.log('YNAB service initialized:', ynabService.isInitialized(), refreshToken ? '(with refresh token)' : '(no refresh token)');
    } else {
      console.log('No access token provided to initialize YNAB service');
    }
  }, [accessToken, refreshToken, userId]);
};

const ynabQueryRetryFn = (failureCount, error) => {
  // Check if the error message indicates an authentication failure
  if (error && error.message && error.message.toLowerCase().includes('authentication failed')) {
    return false; // Do not retry on auth errors
  }
  // Default retry behavior for other errors (e.g., network issues)
  return failureCount < 2;
};

// Get YNAB Budgets
export const useYNABBudgets = (enabled = false) => {
  return useQuery({
    queryKey: ynabQueryKeys.budgets(),
    queryFn: () => ynabService.getBudgets(),
    enabled: enabled,
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: ynabQueryRetryFn,
  });
};

// Get YNAB Accounts
export const useYNABAccounts = (budgetId = 'last-used', enabled = false) => {
  return useQuery({
    queryKey: ynabQueryKeys.accounts(budgetId),
    queryFn: () => ynabService.getAccounts(budgetId),
    enabled: enabled,
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: ynabQueryRetryFn,
  });
};

// Get YNAB Transactions
export const useYNABTransactions = (budgetId = 'last-used', enabled = false) => {
  return useQuery({
    queryKey: ynabQueryKeys.transactions(budgetId),
    queryFn: () => ynabService.getTransactions(budgetId),
    enabled: enabled,
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: ynabQueryRetryFn,
  });
};

// Get YNAB Categories
export const useYNABCategories = (budgetId = 'last-used', enabled = false) => {
  return useQuery({
    queryKey: ynabQueryKeys.categories(budgetId),
    queryFn: () => ynabService.getCategories(budgetId),
    enabled: enabled,
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: ynabQueryRetryFn,
  });
};

// Get YNAB Budget Months
export const useYNABMonths = (budgetId = 'last-used', enabled = false) => {
  return useQuery({
    queryKey: ynabQueryKeys.months(budgetId),
    queryFn: () => ynabService.getMonths(budgetId),
    enabled: enabled,
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: ynabQueryRetryFn,
  });
};

// Get Complete YNAB Budget Summary
export const useYNABSummary = (budgetId = 'last-used', enabled = false) => {
  return useQuery({
    queryKey: ynabQueryKeys.summary(budgetId),
    queryFn: () => ynabService.getBudgetSummary(budgetId),
    enabled: enabled,
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: ynabQueryRetryFn,
  });
};

// Combined hook for all YNAB data
// Optimized: Only uses getBudgetSummary which fetches all data in parallel
// This reduces API calls from 10+ to just 5
export const useYNABData = (budgetId = 'last-used', enabled = false, accessToken = null, refreshToken = null, userId = null) => {
  // Initialize YNAB service when access token is provided
  useInitializeYNAB(accessToken, refreshToken, userId);

  // Use accessToken presence instead of ynabService.isInitialized() for enabling queries
  const shouldEnable = enabled && !!accessToken;

  // Only use the summary query - it fetches all data in parallel internally
  const summary = useYNABSummary(budgetId, shouldEnable);

  // Extract data from summary response
  const summaryData = summary.data || {};

  return {
    budgets: summaryData.budgets || [],
    accounts: summaryData.accounts || [],
    transactions: summaryData.transactions || [],
    categories: summaryData.categories || { category_groups: [] },
    months: summaryData.months || [],
    summary: summaryData,
    isLoading: summary.isLoading,
    isError: summary.isError,
    error: summary.error,
    refetch: () => {
      summary.refetch();
    },
  };
};

// Refresh all YNAB data
export const useRefreshYNABData = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({ queryKey: ynabQueryKeys.all });
    },
  });
};
