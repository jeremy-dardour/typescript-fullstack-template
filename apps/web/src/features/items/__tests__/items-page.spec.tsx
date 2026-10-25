import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { ItemsPage } from '@/features/items/items-page';
import {
  API_BASE,
  problemResponse,
  server,
  setupItemsApi,
} from '@/testing/mock-api';
import { renderWithApp } from '@/testing/render-with-app';

import type { Item } from '@/api/hooks/use-items';

const EXISTING: Item = {
  id: 'item-existing',
  name: 'Existing item',
  description: 'Already there',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function createItem(name: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Create Item' }));
  await user.type(screen.getByRole('textbox', { name: 'Name' }), name);
  await user.click(screen.getByRole('button', { name: 'Save' }));
}

describe('itemsPage', () => {
  it('lists the items the API returns', async () => {
    setupItemsApi([EXISTING]);
    renderWithApp(<ItemsPage />);

    expect(
      await screen.findByRole('cell', { name: 'Existing item' }),
    ).toBeVisible();
  });

  it('creates an item and shows it in the list', async () => {
    const api = setupItemsApi();
    renderWithApp(<ItemsPage />);
    await screen.findByText('No items found.');

    await createItem('New item');

    expect(await screen.findByRole('cell', { name: 'New item' })).toBeVisible();
    expect(api.getItems()).toHaveLength(1);
  });

  it("shows the API's problem detail when a create is rejected", async () => {
    const api = setupItemsApi();
    api.failNextCreate(409, 'An item with this name already exists');
    renderWithApp(<ItemsPage />);
    await screen.findByText('No items found.');

    await createItem('Duplicate');

    expect(
      await screen.findByText('An item with this name already exists'),
    ).toBeVisible();
  });

  it('shows the generic error, not the server detail, when the list fails', async () => {
    server.use(
      http.get(`${API_BASE}/api/items`, () =>
        problemResponse(500, { detail: 'relation "item" does not exist' }),
      ),
    );
    renderWithApp(<ItemsPage />);

    expect(await screen.findByText('Please try again later.')).toBeVisible();
    expect(
      screen.queryByText('relation "item" does not exist'),
    ).not.toBeInTheDocument();
  });
});
