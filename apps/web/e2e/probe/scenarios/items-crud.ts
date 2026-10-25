import type { ProbeScenario } from '@/testing/probe.types';

const scenario: ProbeScenario = async ({ page, step, expect }) => {
  const name = `Probe item ${Date.now()}`;

  await step('open the items page', async () => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible();
  });

  await step('create an item', async () => {
    await page.getByRole('button', { name: 'Create Item' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill(name);
    await page
      .getByRole('textbox', { name: 'Description' })
      .fill('created by probe');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();
  });

  await step('delete the item', async () => {
    page.once('dialog', (dialog) => void dialog.accept());
    await page
      .getByRole('row', { name: new RegExp(name) })
      .getByRole('button', { name: 'Delete' })
      .click();
    await expect(page.getByRole('cell', { name, exact: true })).toHaveCount(0);
  });
};

export default scenario;
