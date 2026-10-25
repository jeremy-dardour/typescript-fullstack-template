import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { RouterProvider } from 'react-router/dom';

import { AppProvider } from '@/app/app-provider';
import { ErrorFallback } from '@/app/components/error/error-fallback';
import { GlobalApiErrorDialog } from '@/app/components/error/global-api-error-dialog';
import { router } from '@/app/router';
import { AuthContext } from '@/auth';
import { bootstrap } from '@/bootstrap';
import { ApiErrorProvider } from '@/errors/api-error-provider';
import '@/i18n/i18n';

import './main.css';

function createApp(): React.ReactNode {
  try {
    const { authSystem } = bootstrap();

    return (
      <AuthContext value={authSystem}>
        <ApiErrorProvider>
          <AppProvider>
            <GlobalApiErrorDialog />
            <RouterProvider router={router} />
          </AppProvider>
        </ApiErrorProvider>
      </AuthContext>
    );
  } catch (error) {
    // Bootstrap runs before React mounts, outside the error boundary: without
    // this, a misconfiguration (e.g. no auth adapter) is a blank page.
    console.error(error);
    return <ErrorFallback />;
  }
}

createRoot(document.querySelector('#root')!).render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {createApp()}
    </ErrorBoundary>
  </StrictMode>,
);
