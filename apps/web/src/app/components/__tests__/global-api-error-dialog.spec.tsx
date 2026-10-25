import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ApiError } from '@/api/errors';
import { useApiError } from '@/errors/use-api-error';
import { renderWithApp } from '@/testing/render-with-app';

const ErrorTrigger = ({ error }: { error: Error }) => {
  const { showError } = useApiError();
  return <button onClick={() => showError(error)}>Trigger Error</button>;
};

const renderWithProviders = (ui: React.ReactElement) => renderWithApp(ui);

describe('globalApiErrorDialog', () => {
  it('should not render dialog when there is no error', () => {
    renderWithProviders(<div>App content</div>);

    expect(screen.queryByText('Error')).not.toBeInTheDocument();
  });

  it('should render dialog when API error is shown', async () => {
    const user = userEvent.setup();
    const testError = new ApiError('Test error message', 500, 'Server Error');
    renderWithProviders(<ErrorTrigger error={testError} />);

    await user.click(screen.getByText('Trigger Error'));

    expect(screen.getByText('An error occurred')).toBeVisible();
  });

  it('shows a 4xx problem detail under the translated description', async () => {
    const user = userEvent.setup();
    const testError = new ApiError('Conflict', 409, 'Conflict', {
      detail: 'The item was modified by another request.',
    });
    renderWithProviders(<ErrorTrigger error={testError} />);

    await user.click(screen.getByText('Trigger Error'));

    expect(
      screen.getByText('The item was modified by another request.'),
    ).toBeVisible();
    expect(screen.getByText('Please try again later.')).toBeVisible();
  });

  it('does not show the detail of a server error', async () => {
    const user = userEvent.setup();
    const testError = new ApiError('Internal', 500, 'Internal Server Error', {
      detail: 'relation "item" does not exist',
    });
    renderWithProviders(<ErrorTrigger error={testError} />);

    await user.click(screen.getByText('Trigger Error'));

    expect(screen.getByText('Please try again later.')).toBeVisible();
    expect(
      screen.queryByText('relation "item" does not exist'),
    ).not.toBeInTheDocument();
  });

  it('should close dialog when close button is clicked', async () => {
    const user = userEvent.setup();
    const testError = new ApiError('Test error', 500, 'Server Error');

    renderWithProviders(<ErrorTrigger error={testError} />);

    await user.click(screen.getByText('Trigger Error'));
    expect(screen.getByText('An error occurred')).toBeVisible();

    const closeButton = screen.getByText('Ok');
    await user.click(closeButton);

    expect(screen.queryByText('An error occurred')).not.toBeInTheDocument();
  });

  it('should close dialog when Escape key is pressed', async () => {
    const user = userEvent.setup();
    const testError = new ApiError('Test error', 500, 'Server Error');

    renderWithProviders(<ErrorTrigger error={testError} />);

    await user.click(screen.getByText('Trigger Error'));

    await user.keyboard('{Escape}');

    expect(screen.queryByText('An error occurred')).not.toBeInTheDocument();
  });

  it('should not display dialog for non-API errors', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ErrorTrigger error={new Error('Generic error')} />);

    await user.click(screen.getByText('Trigger Error'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
