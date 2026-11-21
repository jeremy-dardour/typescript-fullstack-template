import { test as base } from '@playwright/test';

import type { Item, ItemPage } from '@/api/hooks/use-items';
import type { Page } from '@playwright/test';

const IS_PLAYWRIGHT_USE_API_MOCK =
  process.env.PLAYWRIGHT_USE_API_MOCK === 'true';

export interface ApiMock {
  getItems: (response: Item[], status?: number) => Promise<Item[]>;
}

export const test = base.extend<{ apiMock: ApiMock; page: Page }>({
  page: async ({ page: basePage }, use) => {
    const originalGetByText = basePage.getByText.bind(basePage);
    basePage.getByText = (text: string | RegExp) => {
      return originalGetByText(text, { exact: true });
    };
    await use(basePage);
  },
  apiMock: async ({ page }, use) => {
    const mocks: ApiMock = {
      getItems: async (response, status = 200) => {
        if (!IS_PLAYWRIGHT_USE_API_MOCK) return response;
        await page.route(/\/api\/items(\?.*)?$/, (route) => {
          const parameters = new URL(route.request().url()).searchParams;
          const currentPage = Number(parameters.get('page') ?? 1);
          const pageSize = Number(parameters.get('page_size') ?? 20);
          const body: ItemPage = {
            data: response.slice(
              (currentPage - 1) * pageSize,
              currentPage * pageSize,
            ),
            page: currentPage,
            page_size: pageSize,
            total: response.length,
            total_pages: Math.ceil(response.length / pageSize),
          };
          return route.fulfill({ status, json: body });
        });
        return response;
      },
    };
    await use(mocks);
  },
});

export { expect } from '@playwright/test';
