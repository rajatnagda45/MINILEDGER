import { useEffect, type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InteractionProvider } from '@/providers/interaction-provider';

export function createTestClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
}

export function TestQueryProvider({ children, client = createTestClient() }: PropsWithChildren<{ client?: QueryClient }>) {
  useEffect(() => () => client.clear(), [client]);
  return <QueryClientProvider client={client}><InteractionProvider>{children}</InteractionProvider></QueryClientProvider>;
}
