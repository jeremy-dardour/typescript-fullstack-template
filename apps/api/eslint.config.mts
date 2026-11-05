import {
  apiFileRoles,
  boundariesModules,
  featureInterfaces,
  node,
} from '@workspace/eslint-config';

export default [
  ...node(import.meta.dirname),
  // Module boundary checks for VSA/DDD
  ...boundariesModules,
  ...apiFileRoles,
  ...featureInterfaces,
  {
    files: ['src/shared/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Decorator[expression.callee.name=Injectable]',
          message:
            'shared/ contains pure code; injectable services belong in app/ or modules/.',
        },
      ],
    },
  },
  {
    files: ['**/package.json'],
    rules: {
      'package-json/valid-devDependencies': 'off', // Allow link: local deps
      'package-json/require-type': 'off', // CJS Nest build has no "type" field
    },
  },
  {
    files: ['**/*Migration*.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
      'unicorn/filename-case': 'off',
    },
  },
];
