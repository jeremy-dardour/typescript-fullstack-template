import { composeConfig } from '@workspace/eslint-config';

export default [
  ...composeConfig({
    typescript: { tsconfigRootDir: import.meta.dirname },
    react: true,
    prettier: true,
    packageJson: true,
    vitest: true,
    stylistic: true,
    a11y: true,

    // Disallow ../ relative imports, use @/ alias
    imports: {
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
];
