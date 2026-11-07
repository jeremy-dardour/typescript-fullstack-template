/**
 * Regression tests for API architecture lint rules, run by this package's lint
 * command. Temporary modules exercise allowed dependencies and rejected bypasses;
 * failures exit nonzero so CI catches changes that weaken enforcement.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ESLint } from 'eslint';
import tsParser from 'typescript-eslint';

import { boundariesModules } from './boundaries';
import { featureInterfaces } from './feature-interface';
import { apiFileRoles } from './file-roles';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'api-architecture-'));
const fixtures: Record<string, string> = {
  'src/modules/owner/index.ts':
    "export { OwnerModule } from './owner.module'; export { save } from './owner.store'; export type { Row } from './row.types';",
  'src/modules/owner/owner.module.ts': 'export class OwnerModule {}',
  'src/modules/owner/owner.store.ts': 'export function save() {}',
  'src/modules/owner/row.types.ts': 'export interface Row {}',
  'src/modules/owner/owner.repository.ts': 'export class OwnerRepository {}',
  'src/app/auth/index.ts':
    "export { AuthService } from './auth.service'; export { session } from './session.store';",
  'src/app/auth/session.store.ts': 'export function session() {}',
  'src/app/auth/auth.service.ts': 'export class AuthService {}',
  'src/modules/caller/caller.module.ts': '',
  'src/modules/caller/caller.repository.ts': '',
  'src/modules/caller/caller.service.ts': '',
  'src/app/logger/logger.service.ts': '',
  'src/commands/example.command.ts': '',
};
try {
  await fs.writeFile(
    path.join(root, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }),
  );
  for (const [file, content] of Object.entries(fixtures)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  }
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      { files: ['**/*.ts'], languageOptions: { parser: tsParser.parser } },
      ...boundariesModules,
      ...featureInterfaces,
      ...apiFileRoles,
      {
        settings: {
          'boundaries/root-path': root,
          'import/resolver': {
            typescript: { project: path.join(root, 'tsconfig.json') },
          },
        },
      },
    ],
  });
  let count = 0;
  async function check(file: string, code: string, isDenied = false) {
    const [result] = await eslint.lintText(code, {
      filePath: path.join(root, file),
    });
    assert.equal(
      Boolean(result?.errorCount),
      isDenied,
      `${file}: ${code}\n${JSON.stringify(result?.messages)}`,
    );
    count++;
  }
  for (const consumer of [
    'src/modules/caller/caller.service.ts',
    'src/app/logger/logger.service.ts',
    'src/commands/example.command.ts',
  ]) {
    await check(
      consumer,
      `import { AuthService } from '${root}/src/app/auth';`,
    );
    // Relative paths differ across folders; use explicit absolute targets for resolver checks.
    await check(
      consumer,
      `import { AuthService } from '${root}/src/app/auth/auth.service';`,
      true,
    );
  }
  await check(
    'src/modules/caller/caller.repository.ts',
    "import { save as persist } from '../owner';",
  );
  await check(
    'src/modules/caller/caller.module.ts',
    "import { OwnerModule } from '../owner';",
  );
  await check(
    'src/modules/caller/caller.service.ts',
    "import type { Row } from '../owner';",
  );
  await check(
    'src/modules/caller/caller.service.ts',
    "import { Row } from '../owner';",
    true,
  );
  await check(
    'src/modules/caller/caller.service.ts',
    "import { save } from '../owner';",
    true,
  );
  await check(
    'src/modules/caller/caller.repository.ts',
    "import { OwnerModule } from '../owner';",
    true,
  );
  await check(
    'src/modules/caller/caller.repository.ts',
    "import { OwnerRepository } from '../owner/owner.repository';",
    true,
  );
  await check(
    'src/modules/caller/caller.repository.ts',
    "import * as owner from '../owner';",
    true,
  );
  await check(
    'src/modules/owner/index.ts',
    "export { OwnerRepository } from './owner.repository';",
    true,
  );
  await check(
    'src/modules/owner/owner.service.ts',
    "import { save } from './index';",
    true,
  );
  await check(
    'src/modules/owner/owner.service.ts',
    "import { save } from './owner.store';",
    true,
  );
  await check(
    'src/modules/owner/owner.module.ts',
    "import { save } from './owner.store';",
  );
  await check(
    'src/modules/owner/owner.repository.ts',
    "import { save } from './owner.store';",
  );
  await check(
    'src/modules/owner/index.ts',
    "export * from './owner.store';",
    true,
  );
  await check(
    'src/modules/caller/caller.repository.ts',
    "export { save } from '../owner';",
    true,
  );
  await check(
    'src/modules/caller/caller.repository.ts',
    "const owner = import('../owner');",
    true,
  );
  await check(
    'src/modules/caller/caller.repository.ts',
    "import { save } from '@/modules/owner';",
  );
  await check(
    'src/modules/caller/caller.service.ts',
    "import { save } from '@/modules/owner';",
    true,
  );
  await check(
    'src/app/logger/logger.service.ts',
    "import { AuthService } from '@/app/auth';",
  );
  await check(
    'src/app/logger/logger.service.ts',
    "import { AuthService } from '@/app/auth/auth.service';",
    true,
  );
  await check(
    'src/modules/owner/repositories/index.ts',
    "export { save } from '../owner.store';",
    true,
  );
  await check(
    'src/modules/owner/repositories/barrel.types.ts',
    "export * from '../owner.store';",
    true,
  );
  await check(
    'src/modules/caller/caller.repository.ts',
    "import { session } from '@/app/auth';",
  );
  await check(
    'src/modules/caller/caller.service.ts',
    "import { session } from '@/app/auth';",
    true,
  );
  await check(
    'src/app/logger/logger.repository.ts',
    "import { session } from '@/app/auth';",
  );
  await check(
    'src/app/logger/logger.service.ts',
    "import { session } from '@/app/auth';",
    true,
  );
  await check(
    'src/app/auth/auth.module.ts',
    "import { session } from './session.store';",
  );
  await check(
    'src/app/auth/auth.service.ts',
    "import { session } from './session.store';",
    true,
  );
  await check(
    'src/app/auth/auth.service.ts',
    "import { session } from './index';",
    true,
  );
  await check(
    'src/app/auth/index.ts',
    "export * from './session.store';",
    true,
  );
  await check(
    'src/app/auth/index.ts',
    "export { session } from './session.store';",
  );
  await check(
    'src/app/auth/session.types.ts',
    "export { session } from './session.store';",
    true,
  );
  await check(
    'src/commands/example.command.ts',
    "import { session } from '@/app/auth';",
    true,
  );
  await check(
    'src/modules/caller/caller.service.ts',
    "import * as auth from '@/app/auth';",
    true,
  );
  for (const role of [
    'service',
    'repository',
    'store',
    'types',
    'errors',
    'schema',
    'constants',
    'util',
  ])
    await check(`src/shared/example.${role}.ts`, '');
  for (const role of ['query', 'strategy', 'helper', 'mapper', 'exception'])
    await check(`src/shared/example.${role}.ts`, '', true);
  for (const file of [
    'src/main.ts',
    'src/commands/main.ts',
    'src/shared/index.ts',
    'src/shared/example.test.ts',
    'src/database/migrations/Migration123.ts',
    'src/database/factories/example.factory.ts',
    'src/database/seeders/example.ts',
  ])
    await check(file, '');
  process.stdout.write(`Architecture checks passed (${count} cases).\n`);
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
