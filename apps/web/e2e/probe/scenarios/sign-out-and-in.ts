import type { ProbeScenario } from '@/testing/probe.types';

const scenario: ProbeScenario = async ({ page, step, expect }) => {
  await step('open the app signed in', async () => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible();
  });

  await step('sign out to the landing page', async () => {
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByText('Sign in to continue.')).toBeVisible();
  });

  await step('sign back in with the development user', async () => {
    await page
      .getByRole('button', { name: 'Continue as the development user' })
      .click();
    await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible();
  });
};

export default scenario;
