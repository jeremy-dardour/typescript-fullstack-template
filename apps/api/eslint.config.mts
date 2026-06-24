import { composeConfig } from '@workspace/eslint-config';

export default [
  ...composeConfig({
    typescript: {
      tsconfigRootDir: import.meta.dirname,
    },
    prettier: true,
    packageJson: {
      overrides: {
        'package-json/valid-devDependencies': 'off', // Allow link: local deps
        'package-json/require-type': 'off', // Allow "type" field to be missing
      },
    },
    vitest: true,
    // Enable module boundary checks for VSA/DDD
    boundaries: {
      preset: 'modules',
    },
    unicorn: {
      overrides: {},
    },

    // Disallow ../ relative imports, use @/ alias
    imports: {
      // Allow setup side-effect imports (dotenv/config) without warnings
      warnOnUnassignedImports: false,
      overrides: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['../*', '../**'],
                message: 'Use @/ path alias instead of ../ relative imports',
              },
            ],
          },
        ],
      },
    },
  }),
  {
    files: ['**/*Migration*.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
      'unicorn/filename-case': 'off',
    },
  },
];
