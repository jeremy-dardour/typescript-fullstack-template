import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = path.join(import.meta.dirname, 'check-module-cycles.mts');

const roots: string[] = [];

function check(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'module-cycles-'));
  roots.push(root);
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return spawnSync(process.execPath, [SCRIPT, root], { encoding: 'utf8' });
}

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

describe('check-module-cycles', () => {
  it('passes an acyclic graph, ignoring tests and in-module imports', () => {
    const result = check({
      'modules/a/a.service.ts':
        "import { B } from '@/modules/b';\nimport { x } from './x.util';",
      'modules/b/b.service.ts':
        "import { C } from '../c';\nexport { D } from '@/modules/c/d.types';",
      'modules/c/c.service.ts': "import { Shared } from '@/shared';",
      'modules/c/c.service.spec.ts': "import { A } from '@/modules/a';",
      'modules/c/__tests__/helper.ts': "import { A } from '../../a';",
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('fails a two-module cycle and names each edge', () => {
    const result = check({
      'modules/a/a.service.ts': "import { B } from '@/modules/b';",
      'modules/b/repositories/b.repository.ts':
        "\nconst a = import('../../a');",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Module dependency cycle: a -> b -> a');
    expect(result.stderr).toContain('a -> b: modules/a/a.service.ts:1');
    expect(result.stderr).toContain(
      'b -> a: modules/b/repositories/b.repository.ts:2',
    );
  });

  it('fails a three-module cycle', () => {
    const result = check({
      'modules/a/a.service.ts': "import { B } from '@/modules/b';",
      'modules/b/b.service.ts': "export { C } from '../c';",
      'modules/c/c.service.ts': "import { A } from '@/modules/a/index';",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Module dependency cycle: a -> b -> c -> a',
    );
  });

  it('fails a cycle formed only by type imports', () => {
    const result = check({
      'modules/a/a.service.ts': "import type { B } from '@/modules/b';",
      'modules/b/b.service.ts': "import type { A } from '../a';",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Module dependency cycle: a -> b -> a');
  });
});
