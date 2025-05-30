import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ynabService } from '../lib/ynabApi';
import { queryKeys } from '../lib/queryClient';
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
export const useInitializeYNAB = (accessToken) => {
  useEffect(() => {
    if (accessToken) {
      console.log('Initializing YNAB service with token:', accessToken.substring(0, 10) + '...');
      ynabService.init(accessToken);
      console.log('YNAB service initialized:', ynabService.isInitialized());
    } else {
      console.log('No access token provided to initialize YNAB service');
    }
  }, [accessToken]);
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
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: ynabQueryRetryFn,
  });
};

// Get YNAB Accounts
export const useYNABAccounts = (budgetId = 'last-used', enabled = false) => {
  return useQuery({
    queryKey: ynabQueryKeys.accounts(budgetId),
    queryFn: () => ynabService.getAccounts(budgetId),
    enabled: enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: ynabQueryRetryFn,
  });
};

// Get YNAB Transactions
export const useYNABTransactions = (budgetId = 'last-used', enabled = false) => {
  return useQuery({
    queryKey: ynabQueryKeys.transactions(budgetId),
    queryFn: () => ynabService.getTransactions(budgetId),
    enabled: enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: ynabQueryRetryFn,
  });
};

// Get YNAB Categories
export const useYNABCategories = (budgetId = 'last-used', enabled = false) => {
  return useQuery({
    queryKey: ynabQueryKeys.categories(budgetId),
    queryFn: () => ynabService.getCategories(budgetId),
    enabled: enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: ynabQueryRetryFn,
  });
};

// Get YNAB Budget Months
export const useYNABMonths = (budgetId = 'last-used', enabled = false) => {
  return useQuery({
    queryKey: ynabQueryKeys.months(budgetId),
    queryFn: () => ynabService.getMonths(budgetId),
    enabled: enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: ynabQueryRetryFn,
  });
};

// Get Complete YNAB Budget Summary
export const useYNABSummary = (budgetId = 'last-used', enabled = false) => {
  return useQuery({
    queryKey: ynabQueryKeys.summary(budgetId),
    queryFn: () => ynabService.getBudgetSummary(budgetId),
    enabled: enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: ynabQueryRetryFn,
  });
};

// Combined hook for all YNAB data
export const useYNABData = (budgetId = 'last-used', enabled = false, accessToken = null) => {
  // Initialize YNAB service when access token is provided
  useInitializeYNAB(accessToken);
  
  // Use accessToken presence instead of ynabService.isInitialized() for enabling queries
  const shouldEnable = enabled && !!accessToken;
  
  const budgets = useYNABBudgets(shouldEnable);
  const accounts = useYNABAccounts(budgetId, shouldEnable);
  const transactions = useYNABTransactions(budgetId, shouldEnable);
  const categories = useYNABCategories(budgetId, shouldEnable);
  const months = useYNABMonths(budgetId, shouldEnable);
  const summary = useYNABSummary(budgetId, shouldEnable);

  const isLoading = budgets.isLoading || accounts.isLoading || transactions.isLoading || 
                    categories.isLoading || months.isLoading || summary.isLoading;
  
  const isError = budgets.isError || accounts.isError || transactions.isError || 
                  categories.isError || months.isError || summary.isError;
  
  const error = budgets.error || accounts.error || transactions.error || 
                categories.error || months.error || summary.error;

  return {
    budgets: budgets.data || [],
    accounts: accounts.data || [],
    transactions: transactions.data || [],
    categories: categories.data || [],
    months: months.data || [],
    summary: summary.data || null,
    isLoading,
    isError,
    error,
    refetch: () => {
      budgets.refetch();
      accounts.refetch();
      transactions.refetch();
      categories.refetch();
      months.refetch();
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
