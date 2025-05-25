import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ynabService } from '../lib/ynabApi';
import { queryKeys } from '../lib/queryClient';

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
export const useInitializeYNAB = () => {
  return useMutation({
    mutationFn: (accessToken) => {
      ynabService.init(accessToken);
      return Promise.resolve();
    },
  });
};

// Get YNAB Budgets
export const useYNABBudgets = (enabled = false) => {
  return useQuery({
    queryKey: ynabQueryKeys.budgets(),
    queryFn: () => ynabService.getBudgets(),
    enabled: enabled && ynabService.isInitialized(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
};

// Get YNAB Accounts
export const useYNABAccounts = (budgetId = 'last-used', enabled = false) => {
  return useQuery({
    queryKey: ynabQueryKeys.accounts(budgetId),
    queryFn: () => ynabService.getAccounts(budgetId),
    enabled: enabled && ynabService.isInitialized(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get YNAB Transactions
export const useYNABTransactions = (budgetId = 'last-used', enabled = false) => {
  return useQuery({
    queryKey: ynabQueryKeys.transactions(budgetId),
    queryFn: () => ynabService.getTransactions(budgetId),
    enabled: enabled && ynabService.isInitialized(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Get YNAB Categories
export const useYNABCategories = (budgetId = 'last-used', enabled = false) => {
  return useQuery({
    queryKey: ynabQueryKeys.categories(budgetId),
    queryFn: () => ynabService.getCategories(budgetId),
    enabled: enabled && ynabService.isInitialized(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Get YNAB Budget Months
export const useYNABMonths = (budgetId = 'last-used', enabled = false) => {
  return useQuery({
    queryKey: ynabQueryKeys.months(budgetId),
    queryFn: () => ynabService.getMonths(budgetId),
    enabled: enabled && ynabService.isInitialized(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get Complete YNAB Budget Summary
export const useYNABSummary = (budgetId = 'last-used', enabled = false) => {
  return useQuery({
    queryKey: ynabQueryKeys.summary(budgetId),
    queryFn: () => ynabService.getBudgetSummary(budgetId),
    enabled: enabled && ynabService.isInitialized(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Combined hook for all YNAB data
export const useYNABData = (budgetId = 'last-used', enabled = false) => {
  const budgets = useYNABBudgets(enabled);
  const accounts = useYNABAccounts(budgetId, enabled);
  const transactions = useYNABTransactions(budgetId, enabled);
  const categories = useYNABCategories(budgetId, enabled);
  const months = useYNABMonths(budgetId, enabled);
  const summary = useYNABSummary(budgetId, enabled);

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