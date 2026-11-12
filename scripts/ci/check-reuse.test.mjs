import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldRunChecks, testInputFingerprint } from './check-reuse.mjs';

const tree = (...entries) =>
  entries
    .map(([path, id = 'a'.repeat(40), mode = '100644']) => {
      return `${mode} blob ${id}\t${path}`;
    })
    .join('\0') + '\0';

const source = ['apps/api/src/main.ts'];
const base = testInputFingerprint(tree(source));

test('documentation and agent instructions are not test inputs', () => {
  for (const path of [
    'README.md',
    'AGENTS.md',
    'apps/api/STANDARDS.md',
    'packages/eslint-config/README.md',
    'docs/adr/0001-example.md',
    'docs/sessions/2026-01-01-01-example.md',
    '.claude/rules/api.md',
    '.claude/skills/verify-app/SKILL.md',
    '.claude/settings.json',
    '.agents/skills/verify-app',
    '.vscode/settings.json',
    'LICENSE',
  ]) {
    assert.equal(testInputFingerprint(tree(source, [path])), base, path);
  }
});

test('everything else is a test input', () => {
  for (const path of [
    'apps/api/src/app.module.ts',
    'apps/web/src/features/items/README.md',
    'apps/api/.env.example',
    'package.json',
    'pnpm-lock.yaml',
    'scripts/verify-app.sh',
    'scripts/ci/check-reuse.mjs',
    'deployment/Dockerfile',
    '.github/workflows/ci.yml',
    'some-new-folder/file.txt',
  ]) {
    assert.notEqual(testInputFingerprint(tree(source, [path])), base, path);
  }
});

test('content, mode, rename and deletion change the fingerprint', () => {
  const [path] = source;
  assert.notEqual(testInputFingerprint(tree([path, 'b'.repeat(40)])), base);
  assert.notEqual(
    testInputFingerprint(tree([path, 'a'.repeat(40), '100755'])),
    base,
  );
  assert.notEqual(testInputFingerprint(tree(['apps/api/src/boot.ts'])), base);
  assert.notEqual(testInputFingerprint(tree()), base);
});

test('a malformed tree is rejected', () => {
  assert.throws(() => testInputFingerprint('100644 blob abc no-tab\0'));
});

const reusable = {
  cacheHit: 'true',
  ref: 'refs/pull/5/merge',
  eventName: 'pull_request',
  runAttempt: '1',
};

test('only an exact cache hit skips the tests', () => {
  assert.equal(shouldRunChecks(reusable), false);
  for (const cacheHit of ['false', '', undefined, 'unexpected']) {
    assert.equal(shouldRunChecks({ ...reusable, cacheHit }), true);
  }
});

test('main, manual dispatch, re-runs and unknown attempts run the tests', () => {
  for (const change of [
    { ref: 'refs/heads/main' },
    { eventName: 'workflow_dispatch' },
    { runAttempt: '2' },
    { runAttempt: undefined },
    { runAttempt: 'invalid' },
  ]) {
    assert.equal(shouldRunChecks({ ...reusable, ...change }), true);
  }
});
