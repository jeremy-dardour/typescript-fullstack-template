import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => {
      errors.push(`page: ${error.message}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 500) {
        errors.push(
          `${response.request().method()} ${response.url()} → ${response.status()}`,
        );
      }
    });
    await use(page);
    if (errors.length > 0) {
      await testInfo.attach('browser-errors', {
        body: errors.join('\n'),
        contentType: 'text/plain',
      });
    }
    expect(errors, 'unexpected browser errors').toEqual([]);
  },
});

export { expect } from '@playwright/test';
