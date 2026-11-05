import { expect, test } from './fixtures';

test('create, persist, update and delete an item', async ({ page }) => {
  let name = `Probe item ${Date.now()}`;

  await test.step('open the items page', async () => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible();
  });

  await test.step('create an item', async () => {
    await page.getByRole('button', { name: 'Create Item' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill(name);
    await page
      .getByRole('textbox', { name: 'Description' })
      .fill('created by probe');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();
  });

  await test.step('read the persisted item after reloading', async () => {
    await page.reload();
    await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();
  });

  await test.step('update the item', async () => {
    await page
      .getByRole('row', { name: new RegExp(name) })
      .getByRole('button', { name: 'Edit' })
      .click();
    name += ' updated';
    await page.getByRole('textbox', { name: 'Name' }).fill(name);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();
  });

  await test.step('delete the item', async () => {
    page.once('dialog', (dialog) => void dialog.accept());
    await page
      .getByRole('row', { name: new RegExp(name) })
      .getByRole('button', { name: 'Delete' })
      .click();
    await expect(page.getByRole('cell', { name, exact: true })).toHaveCount(0);
  });
});
