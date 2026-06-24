# @workspace/typescript-config

Shared TypeScript configuration presets for the monorepo. Provides base and purpose-specific `tsconfig` files that apps and packages extend.

## Available Configs

| Config                        | Purpose                            |
| ----------------------------- | ---------------------------------- |
| `tsconfig.base.json`          | Base config shared by all packages |
| `tsconfig.nestjs.json`        | NestJS backend apps                |
| `tsconfig.vite.json`          | Vite-based frontend apps           |
| `tsconfig.library.json`       | General library packages           |
| `tsconfig.react-library.json` | React library packages             |
| `tsconfig.vitest.json`        | Vitest test configuration          |
| `tsconfig.nextjs.json`        | Next.js apps (if applicable)       |

## Usage

In a package or app `tsconfig.json`:

```json
{
  "extends": "@workspace/typescript-config/tsconfig.nestjs.json",
  "compilerOptions": {
    "outDir": "./dist"
  }
}
```
