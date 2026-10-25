import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import React, { useEffect } from 'react';

import { isLocallyHandledError, queryConfig } from '@/api/react-query';
import { useAuth } from '@/auth';
import { env } from '@/config/env';
import { formatToApiError } from '@/errors/format-error';
import { useApiError } from '@/errors/use-api-error';

interface AppProviderProperties {
  children: React.ReactNode;
}

export const AppProvider = ({ children }: AppProviderProperties) => {
  const { showError, clearError } = useApiError();
  const auth = useAuth();

  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            if (
              isSessionEnded(error) ||
              isLocallyHandledError(error, query.meta)
            ) {
              return;
            }
            showError(error);
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            if (isSessionEnded(error)) return;
            showError(error);
          },
        }),
        defaultOptions: queryConfig,
      }),
  );

  // Cached data belongs to the session that fetched it: drop it, and any open
  // error, as soon as the session ends so the next user never sees it.
  useEffect(
    () =>
      auth.subscribe(() => {
        if (auth.getState().status === 'authenticated') return;
        queryClient.clear();
        clearError();
      }),
    [auth, queryClient, clearError],
  );

  return (
    <QueryClientProvider client={queryClient}>
      {env.dev && <ReactQueryDevtools />}
      {children}
    </QueryClientProvider>
  );
};

/** A 401 ends the session (auth middleware); the sign-in page replaces the error. */
function isSessionEnded(error: unknown): boolean {
  return formatToApiError(error)?.status === 401;
}
