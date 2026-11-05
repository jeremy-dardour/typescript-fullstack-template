import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { config } from 'dotenv';
import pg from 'pg';

// Use the same PostgreSQL server as e2e, including per-workspace port overrides.
config({ path: '.env.e2e', quiet: true });
config({ path: '.env.e2e.local', override: true, quiet: true });
const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl)
  throw new Error('DATABASE_URL is required for migration verification');
const databaseName = `dod_${randomUUID().replaceAll('-', '')}`;
const databaseUrl = new URL(sourceUrl);
databaseUrl.pathname = `/${databaseName}`;
const ssl =
  process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined;
const admin = new pg.Client({ connectionString: sourceUrl, ssl });
let hasCreatedDatabase = false;

function runOrm(...args) {
  const result = spawnSync('pnpm', ['exec', 'mikro-orm', ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl.href,
      // MikroORM-specific environment settings take precedence over config.
      MIKRO_ORM_CLIENT_URL: databaseUrl.href,
      MIKRO_ORM_DB_NAME: databaseName,
      // migration:up otherwise writes a snapshot named after the disposable DB.
      MIKRO_ORM_MIGRATIONS_SNAPSHOT: 'false',
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`mikro-orm ${args[0]} failed (${result.status})`);
  return result.stdout.replaceAll(/\u{1B}\[[0-9;]*m/gu, '');
}

try {
  await admin.connect();
  // Only this freshly generated identifier is ever created or dropped. The
  // configured application/e2e database is used solely as the admin connection.
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  hasCreatedDatabase = true;
  console.log(`Checking migrations on disposable database ${databaseName}`);
  runOrm('migration:up');
  const output = runOrm('schema:update', '--dump');
  if (!/^Schema is up-to-date\s*$/m.test(output)) {
    throw new Error(
      'Migration drift: migrations do not reproduce the current entity schema',
    );
  }
  console.log('Migration schema matches entities (zero diff).');
} finally {
  try {
    if (hasCreatedDatabase) {
      await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      console.log(`Dropped disposable database ${databaseName}`);
    }
  } finally {
    await admin.end();
  }
}
