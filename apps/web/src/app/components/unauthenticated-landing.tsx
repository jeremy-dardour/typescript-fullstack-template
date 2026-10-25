import { useTranslation } from 'react-i18next';

import { SignInButton } from '@/auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import type { AuthState } from '@/auth';
import type { Translations } from '@/types/i18n';

type UnauthenticatedStatus = Exclude<AuthState['status'], 'authenticated'>;

const MESSAGE_KEYS: Record<UnauthenticatedStatus, keyof Translations> = {
  restoring: 'auth.landing.status.checking',
  anonymous: 'auth.landing.status.signIn',
  error: 'auth.landing.status.error',
};

interface UnauthenticatedLandingProps {
  status: UnauthenticatedStatus;
}

export function UnauthenticatedLanding({
  status,
}: UnauthenticatedLandingProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle role="heading" aria-level={1}>
            {t('auth.landing.title')}
          </CardTitle>
          <CardDescription role="status">
            {t(MESSAGE_KEYS[status])}
          </CardDescription>
        </CardHeader>
        {status === 'restoring' ? null : (
          <CardContent>
            <SignInButton />
          </CardContent>
        )}
      </Card>
    </main>
  );
}
