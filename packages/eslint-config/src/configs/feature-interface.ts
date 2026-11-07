/**
 * Enforce which symbols consumers may import through public module interfaces.
 * The boundaries plugin checks file dependencies; this rule reads explicit named
 * re-exports to distinguish module wiring, repository-only stores, and types.
 * It also blocks store access through secondary barrels or dynamic imports.
 */
import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import type { Linter, Rule } from 'eslint';

/** Resolve public names to their defining file, including renamed re-exports. */
function publicRoles(index: string): Map<string, string> {
  const roles = new Map<string, string>();
  if (!fs.existsSync(index)) return roles;
  const source = ts.createSourceFile(
    index,
    fs.readFileSync(index, 'utf8'),
    ts.ScriptTarget.Latest,
  );
  for (const statement of source.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    )
      continue;
    const target = statement.moduleSpecifier.text;
    const role = /\.(module|store|types)$/.exec(target)?.[1];
    if (!role) continue;
    if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const item of statement.exportClause.elements)
        roles.set(item.name.text, role);
    }
  }
  return roles;
}

const consumers: Rule.RuleModule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      private:
        'Store and cross-feature imports use named exports from the owning index: modules only in .module.ts; stores only in .repository.ts; public types use type-only imports.',
    },
  },
  create(context) {
    const filename = context.filename.split(path.sep).join('/');
    const owner =
      /\/src\/(modules|app)\/([^/]+)\//.exec(filename) ??
      (filename.includes('/src/commands/')
        ? ['commands', 'commands', 'cli']
        : null);
    if (!owner) return {};
    const root = filename.slice(0, filename.indexOf('/src/') + 5);
    function resolve(source: string) {
      return source.startsWith('@/')
        ? path.resolve(root, source.slice(2))
        : path.resolve(path.dirname(filename), source);
    }
    function isOtherFeature(source: string) {
      const match = /\/src\/(modules|app)\/([^/]+)/.exec(resolve(source));
      return Boolean(
        match && (match[1] !== owner?.[1] || match[2] !== owner?.[2]),
      );
    }
    return {
      ExportAllDeclaration(node) {
        if (
          (owner[1] === 'modules' && filename.endsWith('/index.ts')) ||
          String(node.source.value).endsWith('.store') ||
          isOtherFeature(String(node.source.value))
        )
          context.report({ node, messageId: 'private' });
      },
      ExportNamedDeclaration(node) {
        if (
          node.source &&
          (isOtherFeature(String(node.source.value)) ||
            (String(node.source.value).endsWith('.store') &&
              filename !== path.join(root, owner[1], owner[2], 'index.ts')))
        )
          context.report({ node, messageId: 'private' });
      },
      ImportExpression(node) {
        if (
          node.source.type === 'Literal' &&
          isOtherFeature(String(node.source.value))
        )
          context.report({ node, messageId: 'private' });
      },
      ImportDeclaration(node) {
        const source = String(node.source.value);
        const target = source.startsWith('@/')
          ? path.resolve(root, source.slice(2))
          : path.resolve(path.dirname(filename), source);
        const match = /\/src\/(modules|app)\/([^/]+)(.*)$/.exec(target);
        if (!match) return;
        if (
          match[1] === owner[1] &&
          match[2] === owner[2] &&
          match[3] !== '' &&
          match[3] !== '/index'
        ) {
          if (
            target.endsWith('.store') &&
            !filename.endsWith('.repository.ts') &&
            !filename.endsWith('.module.ts') &&
            !filename.endsWith('/index.ts')
          )
            context.report({ node, messageId: 'private' });
          return;
        }
        const index = path.join(root, match[1]!, match[2]!, 'index.ts');
        const roles = publicRoles(index);
        const isValid =
          (match[3] === '' || match[3] === '/index') &&
          node.specifiers.length > 0 &&
          node.specifiers.every((specifier) => {
            if (specifier.type !== 'ImportSpecifier')
              return (
                match[1] === 'app' &&
                !roles.values().toArray().includes('store')
              );
            const role = roles.get(
              specifier.imported.type === 'Identifier'
                ? specifier.imported.name
                : String(specifier.imported.value),
            );
            if (role !== 'store' && match[1] === 'app') return true;
            return (
              (role === 'types' &&
                (('importKind' in node && node.importKind === 'type') ||
                  ('importKind' in specifier &&
                    specifier.importKind === 'type'))) ||
              (role === 'module' && filename.endsWith('.module.ts')) ||
              (role === 'store' && filename.endsWith('.repository.ts'))
            );
          });
        if (!isValid) context.report({ node, messageId: 'private' });
      },
    };
  },
};

export const featureInterfaces: Linter.Config[] = [
  {
    name: 'feature-interface/consumers',
    files: ['**/src/{modules,app,commands}/**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts', '**/__tests__/**'],
    plugins: { 'feature-interface': { rules: { consumers } } },
    rules: { 'feature-interface/consumers': 'error' },
  },
];
