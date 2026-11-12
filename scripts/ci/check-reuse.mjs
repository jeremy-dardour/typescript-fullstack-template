// Lets CI reuse a passing test result when a commit changes nothing the tests
// read. See the "Reusing passing checks" section of the root README.
//
//   node scripts/ci/check-reuse.mjs fingerprint   hash of the committed test inputs
//   node scripts/ci/check-reuse.mjs select        decide whether the test jobs run
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import { pathToFileURL } from 'node:url';

// Paths no test job reads. Everything else is a test input, so a new kind of
// file invalidates the result until it is listed here. The format, lint, type
// and dependency jobs run on every commit and cover these paths.
export const NON_TEST_INPUTS = [
  '*.md',
  '{apps,packages}/*/*.md',
  'docs/**',
  '.claude/**',
  '.agents/**',
  '.clauderc',
  '.github/copilot-instructions.md',
  '.vscode/**',
  'LICENSE',
  'NOTICE',
];

/** @param {string} tree Output of `git ls-tree -r -z HEAD`. */
export function testInputFingerprint(tree) {
  const hash = createHash('sha256');
  for (const entry of tree.split('\0')) {
    if (!entry) continue;
    const separator = entry.indexOf('\t');
    if (separator === -1) throw new Error('Invalid Git tree entry');
    const path = entry.slice(separator + 1);
    if (NON_TEST_INPUTS.some((pattern) => matchesGlob(path, pattern))) continue;
    // The entry holds mode, object ID and path: edits, renames, deletions and
    // chmod all change the fingerprint.
    hash.update(entry).update('\0');
  }
  return hash.digest('hex');
}

/**
 * Tests are skipped only for an exact cache hit on the first attempt of a
 * branch or pull-request run. Anything unknown runs them.
 */
export function shouldRunChecks({ cacheHit, ref, eventName, runAttempt }) {
  return (
    cacheHit !== 'true' ||
    ref === 'refs/heads/main' ||
    eventName === 'workflow_dispatch' ||
    Number(runAttempt) !== 1
  );
}

function main(command) {
  if (command === 'fingerprint') {
    const tree = execFileSync('git', ['ls-tree', '-r', '-z', 'HEAD'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const fingerprint = testInputFingerprint(tree);
    console.log(fingerprint);
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `fingerprint=${fingerprint}\n`);
    }
    return;
  }
  if (command === 'select') {
    const run = shouldRunChecks({
      cacheHit: process.env.CACHE_HIT,
      ref: process.env.GITHUB_REF,
      eventName: process.env.GITHUB_EVENT_NAME,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    });
    const marker = process.env.PASSED_MARKER;
    const source =
      marker && existsSync(marker) ? readFileSync(marker, 'utf8').trim() : '';
    const summary = run
      ? 'Running the test jobs: no passing result for these test inputs, or a full run was requested.'
      : `Reusing the passing test result for identical test inputs (${source || 'source run unknown'}).`;
    console.log(summary);
    appendFileSync(process.env.GITHUB_OUTPUT, `run-tests=${run}\n`);
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
    return;
  }
  throw new Error('Expected "fingerprint" or "select"');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv[2]);
}
