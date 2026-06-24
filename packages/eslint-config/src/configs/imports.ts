import { importX } from 'eslint-plugin-import-x';

import { GLOB_SRC } from '../utils';

import type { OptionsOverrides, OptionsStylistic } from '../types';
import type { Linter } from 'eslint';

/**
 * Import configuration options
 *
 * When TypeScript is enabled:
 * - Auto-disables rules duplicated by TypeScript compiler for better performance
 * - Enables eslint-import-resolver-typescript resolver
 * - Supports tsconfig paths, @types, and other TypeScript features
 */
export interface ImportsOptions extends OptionsOverrides, OptionsStylistic {
  /**
   * Enable TypeScript support
   * @default false
   */
  typescript?: boolean;

  /**
   * Warn about unassigned side-effect imports
   * Useful for detecting unexpected side-effect imports
   * Set to false if you have setup imports (dotenv/config) at the top of files
   * @default true
   */
  warnOnUnassignedImports?: boolean;
}

/**
 * Import-related rules configuration
 *
 * @param options - Configuration options
 * @param options.typescript - Enable TypeScript support (requires eslint-import-resolver-typescript)
 * @param options.stylistic - Enable stylistic rules (e.g., newline-after-import)
 * @param options.overrides - Custom rule overrides
 * @returns ESLint config array
 *
 * TODO: Need to research if supporting react-native, electron, etc. resolution rules
 */
export function imports(options: ImportsOptions = {}): Linter.Config[] {
  const {
    overrides = {},
    stylistic = true,
    typescript = false,
    warnOnUnassignedImports = true,
  } = options;

  const files = [GLOB_SRC];

  return [
    {
      name: 'imports/rules',
      files,
      plugins: {
        'import-x': importX,
      },
      // Conditionally add TypeScript support
      settings: {
        ...(typescript
          ? {
              ...importX.configs['flat/recommended'].settings,
              // Override resolver config, Bun support enabled by default
              'import-x/resolver': {
                typescript: {
                  alwaysTryTypes: true, // Try to find `<root>@types` directory
                },
              },
            }
          : {}),
      },
      rules: {
        ...importX.configs['flat/recommended'].rules,
        ...(typescript ? importX.configs['flat/typescript'].rules : {}),

        // TypeScript optimization: Disable rules duplicated by tsc
        // Reference: https://github.com/un-ts/eslint-plugin-import-x#typescript
        ...(typescript
          ? {
              'import-x/named': 'off', // TS already checks exports
              'import-x/namespace': 'off', // TS already checks namespaces
              'import-x/default': 'off', // TS already checks default exports
              'import-x/no-named-as-default-member': 'off', // TS already checks member access
              'import-x/no-unresolved': 'off', // TS already checks module resolution (when using import)
            }
          : {}),

        // Stylistic rules (optional)
        ...(stylistic
          ? {
              'import-x/newline-after-import': [
                'error',
                { count: 1, considerComments: true },
              ],
              // Import ordering with groups
              // IMPORTANT: Side-effect imports (CSS, polyfills) cannot be auto-fixed.
              // They must be manually placed LAST (after all other imports).
              // ESLint will validate but not move them.
              // See: https://github.com/un-ts/eslint-plugin-import-x/blob/master/docs/rules/order.md#limitations-of---fix
              'import-x/order': [
                'error',
                {
                  groups: [
                    'builtin', // Node.js built-in modules (fs, path, etc.)
                    'external', // npm packages
                    'internal', // Internal modules (@/ alias)
                    ['parent', 'sibling'], // Relative imports (../, ./)
                    'index', // Index files (./)
                    'type', // Type imports
                    'object', // Side-effect imports (CSS, polyfills) - placed here via pathGroups
                  ],
                  'newlines-between': 'always', // Blank lines between groups
                  alphabetize: {
                    order: 'asc', // Ascending alphabetical order
                    caseInsensitive: true, // Ignore case
                  },
                  pathGroups: [
                    {
                      pattern: '@/**', // @ alias paths
                      group: 'internal',
                      position: 'before',
                    },
                    // Side-effect imports (CSS, SCSS) assigned to 'object' group
                    // Note: These CANNOT be auto-fixed - must be manually placed
                    // Placing in separate group ensures newline before them
                    {
                      pattern: '*.{css,scss,sass,less}',
                      patternOptions: { dot: true, nocomment: true },
                      group: 'object',
                      position: 'before',
                    },
                    {
                      pattern: './*.{css,scss,sass,less}',
                      patternOptions: { dot: true, nocomment: true },
                      group: 'object',
                      position: 'before',
                    },
                    {
                      pattern: '../**.{css,scss,sass,less}',
                      patternOptions: { dot: true, nocomment: true },
                      group: 'object',
                      position: 'before',
                    },
                  ],
                  pathGroupsExcludedImportTypes: ['type'], // Allow pathGroups to override all import types
                  distinctGroup: true, // Group type imports separately
                  warnOnUnassignedImports, // Warn about unassigned side-effect imports (configurable)
                },
              ],
            }
          : {}),
        'import-x/consistent-type-specifier-style': 'error',

        // Following rules have no TS equivalent but high performance cost, recommend CI-only:
        'import-x/no-named-as-default': 'warn', // Check default import vs named export conflicts
        'import-x/no-cycle': 'error', // Check circular dependencies
        'import-x/no-unused-modules': 'error', // Check unused modules
        'import-x/no-deprecated': 'warn', // Check deprecated imports
        'import-x/no-extraneous-dependencies': 'error', // Check undeclared dependencies (replaces eslint-plugin-n's no-extraneous-import)

        // TODO: May need to enable for vertical slice architecture
        'import-x/no-relative-parent-imports': 'off',
        'import-x/no-internal-modules': 'off',

        // User custom overrides (applied last, highest priority)
        ...overrides,
      },
    },
  ];
}
