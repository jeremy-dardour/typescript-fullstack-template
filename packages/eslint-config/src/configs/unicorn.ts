import { defineConfig } from 'eslint/config';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';

import { GLOB_SRC } from '../utils';

import type { Linter } from 'eslint';

/**
 * Unicorn best practices (recommended set with workspace adjustments)
 */
export const unicorn: Linter.Config[] = defineConfig({
  name: 'unicorn/rules',
  files: [GLOB_SRC],
  extends: [eslintPluginUnicorn.configs.recommended],
  rules: {
    // Modern libraries like MikroORM and react-query use null by default
    'unicorn/no-null': 'off',
    'unicorn/name-replacements': 'off',
    'unicorn/no-non-function-verb-prefix': 'off',
    'unicorn/no-top-level-side-effects': 'off',
    'unicorn/consistent-class-member-order': 'off',
    'unicorn/no-array-sort': 'off',
    // Both reject the conventional `/** … */` JSDoc layout
    'unicorn/no-asterisk-prefix-in-documentation-comments': 'off',
    'unicorn/single-line-block-comment-style': 'off',
    // Rewrites readable multi-line branches into nested ternaries
    'unicorn/prefer-ternary': 'off',
    // Flags NestJS metadata-key constants such as IS_PUBLIC_KEY
    'unicorn/consistent-boolean-name': 'off',
    'unicorn/filename-case': [
      'error',
      { case: 'kebabCase', ignore: [/^__[\w-]+__$/.source] },
    ],
  },
});
