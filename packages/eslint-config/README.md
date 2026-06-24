# @workspace/eslint-config

Shared, composable ESLint configuration for the monorepo. Provides a unified set of linting rules across all apps and packages.

## Included Configs

| Config         | Description                    |
| -------------- | ------------------------------ |
| `a11y`         | Accessibility rules (jsx-a11y) |
| `boundaries`   | Module boundary enforcement    |
| `depend`       | Dependency rules               |
| `ignores`      | Shared ignore patterns         |
| `imports`      | Import ordering and resolution |
| `jsdoc`        | JSDoc linting                  |
| `package-json` | package.json linting           |
| `prettier`     | Prettier integration           |
| `react`        | React and React Hooks rules    |
| `stylistic`    | Code style rules               |
| `typescript`   | TypeScript-specific rules      |
| `unicorn`      | Unicorn best-practice rules    |
| `vitest`       | Vitest testing rules           |

## Scripts

- `pnpm lint` — Run ESLint on this package
- `pnpm lint:fix` — Run ESLint with auto-fix
- `pnpm format` — Alias for `lint:fix`
- `pnpm check-types` — Run TypeScript type checking

## Usage

In an app or package `eslint.config.mts`:

```ts
import { createConfig } from '@workspace/eslint-config';

export default createConfig({
  /* options */
});
```
