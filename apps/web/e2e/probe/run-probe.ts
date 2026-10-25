/**
 * Drives the running dev app in a real browser and reports what a user would
 * hit: failed steps, console errors, uncaught page errors, and HTTP errors.
 * Start the stack first (scripts/verify-app.sh).
 *
 *   pnpm probe --goto /                  open a page and print its accessibility snapshot
 *   pnpm probe path/to/scenario.ts       run a scenario (see scenarios/items-crud.ts)
 */
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { expect } from '@playwright/test';
import { chromium } from 'playwright';

import type { ProbeScenario } from '@/testing/probe.types';

const WEB_ROOT = path.resolve(import.meta.dirname, '../..');
const OUT_DIR = path.resolve(WEB_ROOT, '../../.verify-app/probe');

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    goto: { type: 'string' },
    headed: { type: 'boolean', default: false },
    'allow-console': { type: 'string', multiple: true, default: [] },
  },
});

function webBaseUrl(): string {
  let port = '5173';
  try {
    const env = readFileSync(path.join(WEB_ROOT, '.env'), 'utf8');
    port = /^WEB_PORT=(\d+)/m.exec(env)?.[1] ?? port;
  } catch {
    // No .env: the Vite default applies.
  }
  return `http://localhost:${port}`;
}

async function loadScenario(): Promise<ProbeScenario> {
  const target = options.goto;
  if (target !== undefined) {
    return async ({ page, step }) => {
      await step(`open ${target}`, () =>
        page.goto(target, { waitUntil: 'networkidle' }),
      );
    };
  }

  const [file] = positionals;
  if (!file) {
    throw new Error('Pass a scenario file or --goto <path>');
  }
  // pnpm runs this from apps/web; resolve against the caller's directory.
  const scenarioPath = path.resolve(process.env.INIT_CWD ?? '.', file);
  const module = (await import(pathToFileURL(scenarioPath).href)) as {
    default: ProbeScenario;
  };
  return module.default;
}

function printSection(title: string, lines: string[]): void {
  if (lines.length > 0) {
    console.log(`\n${title}:\n  ${lines.join('\n  ')}`);
  }
}

async function main(): Promise<boolean> {
  const baseURL = webBaseUrl();
  const allowed = options['allow-console'].map(
    (pattern) => new RegExp(pattern),
  );
  mkdirSync(OUT_DIR, { recursive: true });

  const scenario = await loadScenario();
  const browser = await chromium.launch({ headless: !options.headed });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const httpErrors: string[] = [];
  let hasServerError = false;

  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' && allowed.every((re) => !re.test(text))) {
      consoleErrors.push(text);
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('response', (response) => {
    if (response.status() < 400) {
      return;
    }
    httpErrors.push(
      `${response.request().method()} ${response.url()} → ${response.status()}`,
    );
    hasServerError ||= response.status() >= 500;
  });

  let hasFailedStep = false;
  const step = async (name: string, action: () => Promise<unknown>) => {
    try {
      await action();
      console.log(`✓ ${name}`);
    } catch (error) {
      hasFailedStep = true;
      console.log(`✗ ${name}\n  ${String(error)}`);
      await page.screenshot({ path: path.join(OUT_DIR, 'failed-step.png') });
      throw error;
    }
  };

  console.log(`probe against ${baseURL}`);
  try {
    await scenario({ page, baseURL, expect, step });
    await page.waitForLoadState('networkidle');
  } catch {
    // Already reported by the failing step.
  }

  console.log(`\nPage ${page.url()}:`);
  console.log(await page.locator('body').ariaSnapshot());
  await page.screenshot({ path: path.join(OUT_DIR, 'final.png') });
  printSection('Console errors', consoleErrors);
  printSection('Uncaught page errors', pageErrors);
  printSection('HTTP errors', httpErrors);
  console.log(`\nScreenshots in ${OUT_DIR}`);
  await browser.close();

  return (
    !hasFailedStep &&
    !hasServerError &&
    consoleErrors.length === 0 &&
    pageErrors.length === 0
  );
}

try {
  const isOk = await main();
  console.log(isOk ? '\nprobe: OK' : '\nprobe: FAIL');
  process.exitCode = isOk ? 0 : 1;
} catch (error) {
  console.error(`probe: ${String(error)}`);
  console.error(
    'If Chromium is missing: pnpm --filter web exec playwright install chromium',
  );
  process.exitCode = 1;
}
