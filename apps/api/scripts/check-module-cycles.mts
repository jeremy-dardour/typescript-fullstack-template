/**
 * Fails when the dependency graph between API modules (`src/modules/<name>`)
 * has a cycle. `import-x/no-cycle` sees only file-level cycles, and two
 * modules can depend on each other through their index.ts without one.
 *
 * Usage: node scripts/check-module-cycles.mts [srcDir]
 */
import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

const TEST_FILE = /(?:\.(?:spec|test|e2e-spec)\.ts$|(?:^|\/)__tests__\/)/;

function sourceFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map((file) => file.split(path.sep).join('/'))
    .filter((file) => file.endsWith('.ts') && !TEST_FILE.test(file))
    .map((file) => path.join(dir, file));
}

function moduleOf(srcDir: string, target: string): string | undefined {
  const relative = path.relative(srcDir, target).split(path.sep);
  return relative[0] === 'modules' ? relative[1] : undefined;
}

function findModuleCycles(srcDir: string): string[] {
  const modulesDir = path.join(srcDir, 'modules');
  const names = fs
    .readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const edges = new Map<string, Map<string, string>>();
  for (const name of names) {
    const targets = new Map<string, string>();
    edges.set(name, targets);
    const files = sourceFiles(path.join(modulesDir, name));
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      const { importedFiles } = ts.preProcessFile(text, true, true);
      for (const { fileName, pos } of importedFiles) {
        let target: string | undefined;
        if (fileName.startsWith('@/'))
          target = path.join(srcDir, fileName.slice(2));
        else if (fileName.startsWith('.'))
          target = path.resolve(path.dirname(file), fileName);
        const to = target && moduleOf(srcDir, target);
        if (!to || to === name || targets.has(to)) continue;
        const line = text.slice(0, pos).split('\n').length;
        targets.set(to, `${path.relative(srcDir, file)}:${line}`);
      }
    }
  }

  const cycles: string[] = [];
  const done = new Set<string>();
  const stack: string[] = [];
  function visit(name: string) {
    stack.push(name);
    const targets = edges.get(name)?.keys() ?? [];
    for (const to of targets) {
      const start = stack.indexOf(to);
      if (start !== -1) {
        const cycle = [...stack.slice(start), to];
        const lines = cycle
          .slice(1)
          .map(
            (next, index) =>
              `  ${cycle[index]} -> ${next}: ${edges.get(cycle[index]!)?.get(next)}`,
          );
        cycles.push(
          [`Module dependency cycle: ${cycle.join(' -> ')}`, ...lines].join(
            '\n',
          ),
        );
      } else if (!done.has(to)) visit(to);
    }
    stack.pop();
    done.add(name);
  }
  for (const name of edges.keys()) if (!done.has(name)) visit(name);
  return cycles;
}

const cycles = findModuleCycles(path.resolve(process.argv[2] ?? 'src'));
for (const cycle of cycles) console.error(cycle);
if (cycles.length > 0) process.exitCode = 1;
