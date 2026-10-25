import type { expect } from '@playwright/test';
import type { Page } from 'playwright';

export interface ProbeContext {
  page: Page;
  baseURL: string;
  expect: typeof expect;
  step: (name: string, action: () => Promise<unknown>) => Promise<void>;
}

export type ProbeScenario = (context: ProbeContext) => Promise<void>;
