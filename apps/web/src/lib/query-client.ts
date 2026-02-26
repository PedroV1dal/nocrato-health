import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Polling a cada 30s (sem WebSocket no MVP)
      refetchInterval: 30_000,
      staleTime: 20_000,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
})
