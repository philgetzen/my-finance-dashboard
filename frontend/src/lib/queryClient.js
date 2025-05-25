import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 2,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
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