/**
 * Enforce the closed API filename-role vocabulary in apps/api/STANDARDS.md.
 * Folder boundaries cannot catch a misnamed file inside an otherwise valid area;
 * entrypoints, generated code, and test/data setup files have explicit exemptions.
 */
import path from 'node:path';

import type { Linter, Rule } from 'eslint';

const ROLE_SUFFIXES = [
  'module',
  'controller',
  'service',
  'repository',
  'store',
  'guard',
  'middleware',
  'interceptor',
  'filter',
  'decorator',
  'command',
  'util',
  'mail',
  'policy',
  'types',
  'errors',
  'constants',
  'config',
  'schema',
];

const OTHER_SUFFIXES = ['dto', 'entity', 'd'];

const ROLE_FILE = new RegExp(
  String.raw`\.(?:${[...ROLE_SUFFIXES, ...OTHER_SUFFIXES].join('|')})\.ts$`,
);
const MAIN_FILE = /\/src\/(?:commands\/)?main\.ts$/;

const knownSuffix: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require an API source file name to end with a role suffix',
    },
    schema: [],
    messages: {
      unknownRole: `File name has no role suffix: use .{${ROLE_SUFFIXES.join(',')}}.ts (apps/api/STANDARDS.md, File roles).`,
    },
  },
  create(context) {
    const filePath = context.filename.split(path.sep).join('/');
    const fileName = path.posix.basename(filePath);
    if (
      fileName === 'index.ts' ||
      ROLE_FILE.test(fileName) ||
      MAIN_FILE.test(filePath)
    ) {
      return {};
    }
    return {
      Program(node) {
        context.report({ node, messageId: 'unknownRole' });
      },
    };
  },
};

export const apiFileRoles: Linter.Config[] = [
  {
    name: 'file-roles/api',
    files: ['**/src/**/*.ts'],
    ignores: [
      '**/*.spec.ts',
      '**/*.test.ts',
      '**/__tests__/**',
      '**/generated/**',
      '**/*.e2e-spec.ts',
      '**/__e2e-tests__/**',
      '**/src/database/migrations/**',
      '**/src/database/seeders/**',
      '**/src/database/factories/**',
    ],
    plugins: {
      'file-roles': { rules: { 'known-suffix': knownSuffix } },
    },
    rules: {
      'file-roles/known-suffix': 'error',
    },
  },
];
