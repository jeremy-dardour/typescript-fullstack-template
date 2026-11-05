/**
 * Drives the running dev app in a real browser and reports what a user would
 * hit: failed steps, console errors, uncaught page errors, and HTTP errors.
 * Start the stack first (scripts/verify-app.sh).
 *
 *   pnpm probe --goto /                  open a page and print its accessibility snapshot
 *   pnpm probe path/to/scenario.ts       run a temporary scenario exporting ProbeScenario
 */
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { expect } from '@playwright/test';
import { chromium } from 'playwright';

import type { ProbeScenario } from '@/testing/probe.types';
import type { Browser } from 'playwright';

const WEB_ROOT = path.resolve(import.meta.dirname, '../..');

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    goto: { type: 'string' },
    'out-dir': { type: 'string' },
    headed: { type: 'boolean', default: false },
    'allow-console': { type: 'string', multiple: true, default: [] },
  },
});

const OUT_DIR = path.resolve(
  options['out-dir'] ?? path.join(WEB_ROOT, '../../.verify-app/probe'),
);

function webBaseUrl(): string {
  if (process.env.PLAYWRIGHT_APP_BASE_URL)
    return process.env.PLAYWRIGHT_APP_BASE_URL;
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

async function isProbePassing(): Promise<boolean> {
  const baseURL = webBaseUrl();
  const allowed = options['allow-console'].map(
    (pattern) => new RegExp(pattern),
  );
  // Stale screenshots from an earlier run would read as this run's result.
  mkdirSync(OUT_DIR, { recursive: true });
  for (const artifact of ['failed-step.png', 'final.png']) {
    rmSync(path.join(OUT_DIR, artifact), { force: true });
  }

  const scenario = await loadScenario();
  const browser = await chromium.launch({ headless: !options.headed });
  try {
    return await isScenarioPassing(browser, scenario, baseURL, allowed);
  } finally {
    await browser.close();
  }
}

async function isScenarioPassing(
  browser: Browser,
  scenario: ProbeScenario,
  baseURL: string,
  allowed: RegExp[],
): Promise<boolean> {
  const context = await browser.newContext({ baseURL, locale: 'en-US' });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.setDefaultNavigationTimeout(15_000);

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
  let isReported = false;
  const step = async (name: string, action: () => Promise<unknown>) => {
    try {
      await action();
      console.log(`✓ ${name}`);
    } catch (error) {
      isReported = true;
      console.log(`✗ ${name}\n  ${String(error)}`);
      await page.screenshot({ path: path.join(OUT_DIR, 'failed-step.png') });
      throw error;
    }
  };

  console.log(`probe against ${baseURL}`);
  let scenarioTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      scenario({ page, baseURL, expect, step }),
      new Promise<never>((_, reject) => {
        scenarioTimer = setTimeout(
          () => reject(new Error('Scenario exceeded 30 seconds')),
          30_000,
        );
      }),
    ]);
    await page.waitForLoadState('networkidle');
  } catch (error) {
    hasFailedStep = true;
    if (!isReported) {
      console.log(`✗ scenario failed outside a step\n  ${String(error)}`);
    }
  } finally {
    clearTimeout(scenarioTimer);
  }

  console.log(`\nPage ${page.url()}:`);
  console.log(await page.locator('body').ariaSnapshot());
  await page.screenshot({ path: path.join(OUT_DIR, 'final.png') });
  printSection('Console errors', consoleErrors);
  printSection('Uncaught page errors', pageErrors);
  printSection('HTTP errors', httpErrors);
  console.log(`\nScreenshots in ${OUT_DIR}`);

  return (
    !hasFailedStep &&
    !hasServerError &&
    consoleErrors.length === 0 &&
    pageErrors.length === 0
  );
}

try {
  const isOk = await isProbePassing();
  console.log(isOk ? '\nprobe: OK' : '\nprobe: FAIL');
  process.exitCode = isOk ? 0 : 1;
} catch (error) {
  console.error(`probe: ${String(error)}`);
  console.error(
    'If Chromium is missing: pnpm --filter web exec playwright install chromium',
  );
  process.exitCode = 1;
}
