import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query, where, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { api } from '../lib/api';
import { queryKeys } from '../lib/queryClient';
import { useYNABData } from './useYNABData';

const dbClient = getFirestore();

// Custom hooks for data fetching
export const useAccessTokens = (userId) => {
  return useQuery({
    queryKey: queryKeys.accessTokens(userId),
    queryFn: () => api.getAccessTokens(userId),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // Access tokens are stable, cache for 10 minutes
  });
};

export const useAccounts = (userId) => {
  return useQuery({
    queryKey: queryKeys.accounts(),
    queryFn: () => [],
    enabled: false, // Disable Plaid accounts fetching
    staleTime: 2 * 60 * 1000,
  });
};

export const useTransactions = (userId) => {
  return useQuery({
    queryKey: queryKeys.transactions(),
    queryFn: () => [],
    enabled: false, // Disable Plaid transactions fetching
    staleTime: 1 * 60 * 1000,
  });
};

export const useHoldings = (userId) => {
  const { data: tokenData } = useAccessTokens(userId);
  
  return useQuery({
    queryKey: [...queryKeys.holdings(userId), tokenData?.tokens],
    queryFn: () => api.getHoldings(tokenData?.tokens || []),
    enabled: !!userId && !!tokenData && tokenData?.tokens?.length > 0,
    staleTime: 5 * 60 * 1000, // Holdings are relatively stable
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
};

export const useManualAccounts = (userId) => {
  return useQuery({
    queryKey: queryKeys.manualAccounts(userId),
    queryFn: async () => {
      if (!userId) return [];
      const q = query(collection(dbClient, 'manual_accounts'), where('user_id', '==', userId));
      const querySnapshot = await getDocs(q);
      const accounts = [];
      querySnapshot.forEach(doc => accounts.push({ ...doc.data(), id: doc.id }));
      return accounts;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Manual accounts don't change often
  });
};

// Mutations for optimistic updates
export const useAddManualAccount = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, accountData }) => {
      return await addDoc(collection(dbClient, 'manual_accounts'), {
        user_id: userId,
        ...accountData,
        balance: parseFloat(accountData.balance),
        created_at: new Date().toISOString(),
      });
    },
    onSuccess: (_, { userId }) => {
      // Invalidate and refetch manual accounts
      queryClient.invalidateQueries({ queryKey: queryKeys.manualAccounts(userId) });
    },
  });
};

export const useDeleteManualAccount = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ accountId, userId }) => {
      const accountRef = doc(dbClient, 'manual_accounts', accountId);
      return await deleteDoc(accountRef);
    },
    onSuccess: (_, { userId }) => {
      // Invalidate and refetch manual accounts
      queryClient.invalidateQueries({ queryKey: queryKeys.manualAccounts(userId) });
    },
  });
};

export const usePlaidLink = () => {
  const queryClient = useQueryClient();
  
  const createLinkToken = useMutation({
    mutationFn: api.createLinkToken,
  });

  const exchangeToken = useMutation({
    mutationFn: ({ publicToken, userId }) => 
      api.exchangePublicToken(publicToken)
        .then(data => api.saveAccessToken(userId, data.access_token)),
    onSuccess: (_, { userId }) => {
      // Invalidate all financial data to refresh with new account
      queryClient.invalidateQueries({ queryKey: queryKeys.accessTokens(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.holdings(userId) });
    },
  });

  return { createLinkToken, exchangeToken };
};

export const useRemovePlaidAccount = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, accountId }) => api.removePlaidAccount(userId, accountId),
    onMutate: async ({ userId, accountId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.accounts() });
      await queryClient.cancelQueries({ queryKey: queryKeys.transactions() });
      await queryClient.cancelQueries({ queryKey: queryKeys.holdings(userId) });
      
      // Snapshot the previous values
      const previousAccounts = queryClient.getQueryData(queryKeys.accounts());
      const previousTransactions = queryClient.getQueryData(queryKeys.transactions());
      const previousHoldings = queryClient.getQueryData(queryKeys.holdings(userId));
      
      // Optimistically update accounts
      if (previousAccounts) {
        queryClient.setQueryData(queryKeys.accounts(), 
          previousAccounts.filter(account => account.account_id !== accountId)
        );
      }
      
      // Optimistically update transactions
      if (previousTransactions) {
        queryClient.setQueryData(queryKeys.transactions(),
          previousTransactions.filter(transaction => transaction.account_id !== accountId)
        );
      }
      
      // Optimistically update holdings
      if (previousHoldings) {
        queryClient.setQueryData(queryKeys.holdings(userId),
          previousHoldings.filter(holding => holding.account_id !== accountId)
        );
      }
      
      return { previousAccounts, previousTransactions, previousHoldings };
    },
    onError: (err, { userId }, context) => {
      // Revert optimistic updates on error
      if (context?.previousAccounts) {
        queryClient.setQueryData(queryKeys.accounts(), context.previousAccounts);
      }
      if (context?.previousTransactions) {
        queryClient.setQueryData(queryKeys.transactions(), context.previousTransactions);
      }
      if (context?.previousHoldings) {
        queryClient.setQueryData(queryKeys.holdings(userId), context.previousHoldings);
      }
    },
    onSuccess: (_, { userId }) => {
      // Invalidate all financial data to refresh after account removal
      queryClient.invalidateQueries({ queryKey: queryKeys.accessTokens(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.holdings(userId) });
    },
  });
};

// Combined hook for all financial data
export const useFinancialData = (userId) => {
  const accounts = useAccounts(userId);
  const transactions = useTransactions(userId);
  const manualAccounts = useManualAccounts(userId);

  const isLoading = accounts.isLoading || transactions.isLoading || manualAccounts.isLoading;
  const isError = accounts.isError || transactions.isError || manualAccounts.isError;
  const error = accounts.error || transactions.error || manualAccounts.error;

  return {
    accounts: accounts.data || [],
    transactions: transactions.data || [],
    holdings: [],
    manualAccounts: manualAccounts.data || [],
    isLoading,
    isError,
    error,
    refetch: () => {
      accounts.refetch();
      transactions.refetch();
      manualAccounts.refetch();
    },
  };
};