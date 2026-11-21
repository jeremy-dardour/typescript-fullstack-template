import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

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
  const pagedItems = Array.from({ length: 21 }, (_, index) => ({
    ...EXISTING,
    id: `item-${index}`,
    name: `Item ${index + 1}`,
  }));

  it('navigates pages and disables navigation at the boundaries', async () => {
    setupItemsApi(pagedItems);
    const user = userEvent.setup();
    renderWithApp(<ItemsPage />);

    expect(await screen.findByText('Page 1 of 2 · 21 items')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByRole('cell', { name: 'Item 21' })).toBeVisible();
    expect(
      screen.queryByRole('cell', { name: 'Item 1' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByRole('cell', { name: 'Item 1' })).toBeVisible();
  });

  it('returns to the last valid page after deleting its final item', async () => {
    const api = setupItemsApi(pagedItems);
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    renderWithApp(<ItemsPage />);
    await screen.findByText('Page 1 of 2 · 21 items');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('cell', { name: 'Item 21' });
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Page 1 of 1 · 20 items')).toBeVisible();
    expect(await screen.findByRole('cell', { name: 'Item 1' })).toBeVisible();
    expect(api.getItems()).toHaveLength(20);
  });

  it('returns to page one to show an item created from another page', async () => {
    setupItemsApi(pagedItems);
    const user = userEvent.setup();
    renderWithApp(<ItemsPage />);
    await screen.findByText('Page 1 of 2 · 21 items');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('cell', { name: 'Item 21' });

    await createItem('New first item');

    expect(
      await screen.findByRole('cell', { name: 'New first item' }),
    ).toBeVisible();
    expect(await screen.findByText('Page 1 of 2 · 22 items')).toBeVisible();
  });

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

  it('ends the session on a 401 without an error dialog on top', async () => {
    server.use(
      http.get(`${API_BASE}/api/items`, () =>
        problemResponse(401, {
          title: 'Unauthorized',
          detail: 'Token expired',
        }),
      ),
    );
    const { auth } = renderWithApp(<ItemsPage />);

    await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce());
    expect(screen.queryByText('An error occurred')).not.toBeInTheDocument();
  });
});
