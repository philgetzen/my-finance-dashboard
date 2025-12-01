import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query, where, addDoc, deleteDoc, doc, getFirestore } from 'firebase/firestore';
import { queryKeys } from '../lib/queryClient';

const dbClient = getFirestore();

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

// Combined hook for manual accounts data (Plaid removed)
export const useFinancialData = (userId) => {
  const manualAccounts = useManualAccounts(userId);

  return {
    accounts: [], // Plaid accounts removed
    transactions: [], // Plaid transactions removed
    holdings: [], // Plaid holdings removed
    manualAccounts: manualAccounts.data || [],
    isLoading: manualAccounts.isLoading,
    isError: manualAccounts.isError,
    error: manualAccounts.error,
    refetch: () => {
      manualAccounts.refetch();
    },
  };
};