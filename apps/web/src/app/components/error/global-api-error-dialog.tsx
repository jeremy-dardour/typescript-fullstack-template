import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useApiError } from '@/errors/use-api-error';

export const GlobalApiErrorDialog = () => {
  const { t } = useTranslation();
  const { error, clearError } = useApiError();
  // Only client errors carry a detail written for the user; 5xx details are
  // generic or internal.
  const serverDetail =
    error && error.status >= 400 && error.status < 500
      ? error.detail
      : undefined;

  return (
    <Dialog open={!!error} onOpenChange={(open) => !open && clearError()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('app.errorDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('app.errorDialog.description')}
          </DialogDescription>
        </DialogHeader>
        {serverDetail && (
          <p className="text-sm text-muted-foreground">{serverDetail}</p>
        )}
        <DialogFooter>
          <Button onClick={clearError}>{t('app.errorDialog.okButton')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
