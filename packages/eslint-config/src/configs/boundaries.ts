import { defineConfig } from 'eslint/config';
import boundariesPlugin from 'eslint-plugin-boundaries';

import { GLOB_TESTS } from '../utils';

import type { Linter } from 'eslint';

const AREA_INTERFACE_SUFFIXES =
  'module,service,store,guard,decorator,types,config,schema,filter,interceptor';

const NO_GLOBAL_MODULES_MESSAGE =
  'Modules and app areas are not global: import the owning module instead, and register global guards, filters and interceptors with APP_GUARD, APP_FILTER or APP_INTERCEPTOR providers in the root module.';

/**
 * VSA/DDD module boundaries for the API layout:
 *
 * - `module`   (src/modules/*)  may import: itself, public feature interfaces, shared, app
 * - `commands` (src/commands)   may import: itself, shared, app
 * - `shared`   (src/shared)     may import: shared only
 * - `app`      (src/app/<area>) may import: app, shared
 * - `main`     (src/main.ts, src/*.module.ts) may import anything
 *
 * `database/` is not an element, so every element may import it.
 *
 * `app-interface/dependencies` adds the public-interface rules: a module, the
 * CLI and every other `app/` area import an `app/` area only through its
 * `index.ts`, and that `index.ts` re-exports only its own area's public roles.
 */
export const boundariesModules: Linter.Config[] = defineConfig([
  {
    name: 'boundaries/modules',
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      boundaries: boundariesPlugin,
      // Same plugin under a second name, so the interface rules are their own
      // rule id: an app config can switch them off for one file without
      // losing that file's module-isolation check.
      'app-interface': boundariesPlugin,
    },
    settings: {
      'boundaries/elements': [
        {
          type: 'module',
          pattern: 'src/modules/*',
          capture: ['moduleName'],
        },
        { type: 'commands', pattern: 'src/commands' },
        { type: 'shared', pattern: 'src/shared/**' },
        // One element per area, so `fileInternalPath` is relative to the area.
        { type: 'app', pattern: 'src/app/*', capture: ['area'] },
      ],
      // Element patterns only match folders, so the root-level entry files are
      // classified as a file category. File patterns match the whole path
      // relative to the cwd, hence the leading `**/`.
      'boundaries/files': [
        {
          category: 'main',
          pattern: ['**/src/main.ts', '**/src/*.module.ts', '**/src/*.d.ts'],
        },
        {
          category: 'feature-interface',
          pattern: '**/src/modules/*/index.ts',
        },
        {
          category: 'feature-export',
          pattern: '**/src/modules/**/*.{store,module,types}.ts',
        },
        {
          category: 'area-interface',
          pattern: `**/src/app/**/*.{${AREA_INTERFACE_SUFFIXES}}.ts`,
        },
      ],
      'boundaries/dependency-nodes': ['import', 'dynamic-import', 'export'],
      'boundaries/ignore': ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e-spec.ts'],
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
            },
            {
              from: { element: { type: 'module' } },
              allow: {
                to: {
                  element: { type: 'module' },
                  file: { categories: 'feature-interface' },
                },
              },
            },
            {
              from: { element: { type: 'commands' } },
              allow: {
                to: { element: { type: ['commands', 'shared', 'app'] } },
              },
            },
            {
              from: { element: { type: 'shared' } },
              allow: { to: { element: { type: 'shared' } } },
            },
            {
              from: { element: { type: 'app' } },
              allow: { to: { element: { type: ['app', 'shared'] } } },
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
      'app-interface/dependencies': [
        'error',
        {
          default: 'allow',
          // An area's index.ts re-exports files of its own area, which the
          // plugin skips as internal unless told otherwise.
          checkInternals: true,
          checkUnknownLocals: true,
          policies: [
            {
              from: {
                element: { type: 'module', fileInternalPath: 'index.ts' },
              },
              disallow: {
                to: [
                  { file: { isUnknown: true } },
                  {
                    file: { categories: { noneOf: ['feature-export'] } },
                  },
                  {
                    element: {
                      type: 'module',
                      captured: {
                        moduleName: '!{{ from.element.captured.moduleName }}',
                      },
                    },
                  },
                ],
              },
              message:
                'Feature public indexes export only their own .module.ts, .store.ts and .types.ts interfaces.',
            },
            {
              from: { element: { type: ['module', 'commands'] } },
              disallow: {
                to: { element: { type: 'app', fileInternalPath: '!index.ts' } },
              },
              message:
                'A feature or the CLI imports an app/ area only through its index.ts.',
            },
            {
              from: { element: { type: 'app' } },
              disallow: {
                to: {
                  element: {
                    type: 'app',
                    captured: { area: '!{{ from.element.captured.area }}' },
                    fileInternalPath: '!index.ts',
                  },
                },
              },
              message:
                'An app/ area imports another area only through its index.ts.',
            },
            {
              from: { element: { type: 'app', fileInternalPath: 'index.ts' } },
              disallow: {
                // Both selectors: an uncategorized file is unknown, and noneOf
                // matches only categorized files.
                to: [
                  { file: { isUnknown: true } },
                  { file: { categories: { noneOf: ['area-interface'] } } },
                  {
                    element: {
                      type: 'app',
                      captured: { area: '!{{ from.element.captured.area }}' },
                    },
                  },
                  { element: { type: 'shared' } },
                ],
              },
              message: `An app/ area's index.ts re-exports only its own area's .{${AREA_INTERFACE_SUFFIXES}} files.`,
            },
          ],
        },
      ],

      // Off: file names are checked by apiFileRoles.
      'boundaries/no-unknown-files': 'off',
      // Disabled: external dependencies (node_modules) trigger false positives
      'boundaries/no-unknown-dependencies': 'off',
    },
  },
  {
    // A global module's providers are injectable without an import, which
    // hides the dependency from the boundary rules above.
    name: 'boundaries/no-global-modules',
    files: ['src/modules/**/*.ts', 'src/app/**/*.ts'],
    ignores: GLOB_TESTS,
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `Decorator[expression.callee.name='Global'], Decorator[expression.callee.property.name='Global'], ImportSpecifier[imported.name='Global'][local.name!='Global']`,
          message: NO_GLOBAL_MODULES_MESSAGE,
        },
      ],
    },
  },
]);

/**
 * Web feature isolation: a feature (`src/features/*`) imports its own folder
 * and the app-wide folders outside `features/`, which are not elements and so
 * are always allowed. It never imports a sibling feature.
 */
export const boundariesFeatures: Linter.Config[] = defineConfig([
  {
    name: 'boundaries/features',
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      boundaries: boundariesPlugin,
    },
    settings: {
      'boundaries/elements': [
        { type: 'feature', pattern: 'src/features/*', capture: ['feature'] },
      ],
      'boundaries/dependency-nodes': ['import', 'dynamic-import', 'export'],
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
          default: 'allow',
          message:
            'A feature never imports another feature; move shared code to an app-wide folder outside features/.',
          policies: [
            {
              from: { element: { type: 'feature' } },
              disallow: {
                to: {
                  element: {
                    type: 'feature',
                    captured: {
                      feature: '!{{ from.element.captured.feature }}',
                    },
                  },
                },
              },
            },
          ],
        },
      ],
      'boundaries/no-unknown-files': 'off',
      'boundaries/no-unknown-dependencies': 'off',
    },
  },
]);
