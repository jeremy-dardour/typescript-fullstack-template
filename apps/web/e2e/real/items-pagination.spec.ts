import { expect, test } from './fixtures';

import type { Item } from '@/api/hooks/use-items';

test('browse Item pages and show creation from a later page', async ({
  page,
}) => {
  const apiUrl = process.env.VITE_API_URL;
  if (!apiUrl) throw new Error('VITE_API_URL must identify the running API');
  const headers = { Authorization: 'Bearer pagination-real-stack' };
  const createdIds: string[] = [];
  const marker = `Pagination ${Date.now()}`;

  try {
    await test.step('create enough owned records for multiple pages', async () => {
      for (let index = 0; index < 21; index++) {
        const response = await page.request.post(`${apiUrl}/api/items`, {
          headers,
          data: { name: `${marker} ${index}` },
        });
        expect(response.status()).toBe(201);
        const item = (await response.json()) as Item;
        createdIds.push(item.id);
      }
    });

    await test.step('navigate forward and back through real API pages', async () => {
      await page.goto('/');
      await expect(
        page.getByRole('button', { name: 'Previous', exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole('cell', { name: `${marker} 20`, exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(
        page.getByRole('cell', { name: `${marker} 0`, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('cell', { name: `${marker} 20`, exact: true }),
      ).toHaveCount(0);
      await page.getByRole('button', { name: 'Previous', exact: true }).click();
      await expect(
        page.getByRole('cell', { name: `${marker} 20`, exact: true }),
      ).toBeVisible();
    });

    await test.step('create from page two and return to the new Item', async () => {
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(
        page.getByRole('cell', { name: `${marker} 0`, exact: true }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'Create Item', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Name' })
        .fill(`${marker} created`);
      const responsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url() === `${apiUrl}/api/items`,
      );
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      const response = await responsePromise;
      const created = (await response.json()) as Item;
      createdIds.push(created.id);
      await expect(
        page.getByRole('cell', { name: `${marker} created`, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Previous', exact: true }),
      ).toBeDisabled();
    });
  } finally {
    for (const id of createdIds) {
      const response = await page.request.delete(`${apiUrl}/api/items/${id}`, {
        headers,
      });
      expect(response.status(), `cleanup Item ${id}`).toBe(204);
    }
  }
});
