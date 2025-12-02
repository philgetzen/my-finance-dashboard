import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 60 * 1000, // 1 hour - data considered fresh
      gcTime: 2 * 60 * 60 * 1000, // 2 hours - keep in cache
      retry: 2,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false, // Don't refetch on reconnect, use cache
    },
    mutations: {
      retry: 1,
    },
  },
});

// Query keys factory
export const queryKeys = {
  all: ['finance'],
  accounts: () => [...queryKeys.all, 'accounts'],
  transactions: () => [...queryKeys.all, 'transactions'],
  manualAccounts: (userId) => [...queryKeys.all, 'manual-accounts', userId],
  holdings: (userId) => [...queryKeys.all, 'holdings', userId],
  accessTokens: (userId) => [...queryKeys.all, 'access-tokens', userId],
};