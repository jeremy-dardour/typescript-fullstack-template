import { defineConfig } from 'eslint/config';
import boundariesPlugin from 'eslint-plugin-boundaries';

import type { Linter } from 'eslint';

/**
 * VSA/DDD module boundaries for the API layout:
 *
 * - `module`  (src/modules/*)  may import: itself, shared, app, main
 * - `shared`  (src/shared)     may import: shared only
 * - `app`     (src/app)        may import: app, shared
 * - `main`    (src/main.ts, src/*.module.ts) may import anything
 *
 * Business modules cannot import each other — share code via `shared`
 * or decouple via events.
 */
export const boundariesModules: Linter.Config[] = defineConfig([
  {
    name: 'boundaries/modules',
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      boundaries: boundariesPlugin,
    },
    settings: {
      'boundaries/elements': [
        {
          type: 'module',
          pattern: 'src/modules/*/**',
          capture: ['moduleName'],
        },
        { type: 'shared', pattern: 'src/shared/**' },
        { type: 'app', pattern: 'src/app/**' },
      ],
      // Element patterns only match folders, so the root-level entry files are
      // classified as a file category. File patterns match the whole path
      // relative to the cwd, hence the leading `**/`.
      'boundaries/files': [
        {
          category: 'main',
          pattern: ['**/src/main.ts', '**/src/*.module.ts', '**/src/*.d.ts'],
        },
      ],
      'boundaries/dependency-nodes': ['import', 'dynamic-import'],
      // Ignore test files
      'boundaries/ignore': ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e-spec.ts'],
      // Configure TypeScript path resolver
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'module' } },
              allow: [
                {
                  to: {
                    element: {
                      type: 'module',
                      captured: {
                        moduleName: '{{ from.element.captured.moduleName }}',
                      },
                    },
                  },
                },
                { to: { element: { type: ['shared', 'app'] } } },
                { to: { file: { categories: 'main' } } },
              ],
              message:
                'Modules cannot import each other. Use shared for shared code or decouple via events',
            },
            {
              from: { element: { type: 'shared' } },
              allow: { to: { element: { type: 'shared' } } },
              message: 'shared cannot import other modules',
            },
            {
              from: { element: { type: 'app' } },
              allow: { to: { element: { type: ['app', 'shared'] } } },
              message:
                'app layer should not directly depend on business modules',
            },
            {
              from: { file: { categories: 'main' } },
              allow: [
                { to: { element: { type: ['module', 'shared', 'app'] } } },
                { to: { file: { categories: 'main' } } },
              ],
            },
          ],
        },
      ],

      // Disabled: .d.ts and config files may not match element definitions
      'boundaries/no-unknown-files': 'off',
      // Disabled: external dependencies (node_modules) trigger false positives
      'boundaries/no-unknown-dependencies': 'off',
    },
  },
]);
