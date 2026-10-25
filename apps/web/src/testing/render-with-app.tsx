import { render } from '@testing-library/react';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router';

import { setApiClient } from '@/api/api-client';
import { configureApiClient } from '@/api/configure-api-client';
import { AppProvider } from '@/app/app-provider';
import { GlobalApiErrorDialog } from '@/app/components/error/global-api-error-dialog';
import { AuthContext } from '@/auth';
import { ApiErrorProvider } from '@/errors/api-error-provider';
import en from '@/i18n/locales/en.json';
import { createStubAuth } from '@/testing/stub-auth';

import type { AuthState } from '@/auth';
import type { ReactElement } from 'react';

const appI18n = i18n.createInstance();
await appI18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: en } },
  // Mirrors the app: React already escapes rendered strings, so i18next's own
  // escaping would double-escape names like "Salt & Pepper".
  interpolation: { escapeValue: false },
});

/**
 * Renders `ui` inside the real app providers — query client, API client with
 * auth middleware, error dialog, real English translations — with HTTP mocked
 * by MSW (see mock-api.ts) and an in-memory auth session.
 */
export function renderWithApp(
  ui: ReactElement,
  options: { authState?: AuthState; route?: string } = {},
) {
  const stub = createStubAuth(options.authState);
  setApiClient(configureApiClient(stub.auth));

  const result = render(
    <I18nextProvider i18n={appI18n}>
      <AuthContext value={stub.authSystem}>
        <ApiErrorProvider>
          <AppProvider>
            <GlobalApiErrorDialog />
            <MemoryRouter initialEntries={[options.route ?? '/']}>
              {ui}
            </MemoryRouter>
          </AppProvider>
        </ApiErrorProvider>
      </AuthContext>
    </I18nextProvider>,
  );

  return { ...result, auth: stub.auth, setAuthState: stub.setState };
}
