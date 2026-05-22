#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

const baselinePath = path.join(repoRoot, 'scripts/workspace-terminology-baseline.json');
const writeBaseline = process.argv.includes('--write-baseline');

const governedPrefixes = [
  'api/cmd/',
  'api/database/',
  'api/internal/',
  'api/pkg/',
  'api/routes/',
  'api/test/',
  'api/tests/',
  'cli/',
  'web/src/',
];

const ignoredPrefixes = [
  'api/docs/',
  'cli/dist/',
  'web/.next/',
  'web/coverage/',
  'web/node_modules/',
];

const allowedExtensions = new Set([
  '.cjs',
  '.css',
  '.go',
  '.js',
  '.json',
  '.jsx',
  '.kest',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

const legacyTermPattern =
  /\b(?:project|projects|projectId|projectID|project_id|project_ids|Project|Projects|ProjectId|ProjectID|RequireProjectRole|Project[A-Z][A-Za-z0-9_]*|[a-z][A-Za-z0-9_]*Project[A-Za-z0-9_]*|project[A-Z0-9_][A-Za-z0-9_]*)\b/g;

function listTrackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  return output
    .split('\0')
    .filter(Boolean)
    .filter(file => governedPrefixes.some(prefix => file.startsWith(prefix)))
    .filter(file => !ignoredPrefixes.some(prefix => file.startsWith(prefix)))
    .filter(file => allowedExtensions.has(path.extname(file)));
}

function scanFile(file) {
  const fullPath = path.join(repoRoot, file);
  const content = readFileSync(fullPath, 'utf8');

  if (content.includes('\0')) {
    return null;
  }

  const matches = {};
  for (const match of content.matchAll(legacyTermPattern)) {
    const term = match[0];
    matches[term] = (matches[term] ?? 0) + 1;
  }

  const total = Object.values(matches).reduce((sum, count) => sum + count, 0);
  if (total === 0) {
    return null;
  }

  return { total, matches };
}

function scanRepository() {
  const files = {};

  for (const file of listTrackedFiles()) {
    const result = scanFile(file);
    if (result) {
      files[file] = result;
    }
  }

  return {
    version: 1,
    description:
      'Current legacy project terminology baseline. The default check fails when governed files add new project/projectId/projects terms.',
    governedPrefixes,
    ignoredPrefixes,
    files,
  };
}

function getTotal(snapshot) {
  return Object.values(snapshot.files).reduce((sum, file) => sum + file.total, 0);
}

function compareAgainstBaseline(current, baseline) {
  const violations = [];
  const staleBaseline = [];

  for (const [file, currentEntry] of Object.entries(current.files)) {
    const baselineEntry = baseline.files[file] ?? { matches: {} };

    for (const [term, count] of Object.entries(currentEntry.matches)) {
      const allowed = baselineEntry.matches?.[term] ?? 0;
      if (count > allowed) {
        violations.push({
          file,
          term,
          added: count - allowed,
          current: count,
          allowed,
        });
      }
    }
  }

  for (const [file, baselineEntry] of Object.entries(baseline.files)) {
    const currentEntry = current.files[file] ?? { matches: {} };

    for (const [term, allowed] of Object.entries(baselineEntry.matches)) {
      const count = currentEntry.matches?.[term] ?? 0;
      if (count < allowed) {
        staleBaseline.push({
          file,
          term,
          removed: allowed - count,
          current: count,
          allowed,
        });
      }
    }
  }

  return { violations, staleBaseline };
}

function printViolations(violations) {
  console.error('Workspace terminology check failed.');
  console.error('');
  console.error('New legacy project terminology was introduced in governed files:');

  for (const violation of violations.slice(0, 40)) {
    console.error(
      `- ${violation.file}: ${violation.term} +${violation.added} (${violation.current}/${violation.allowed})`
    );
  }

  if (violations.length > 40) {
    console.error(`- ...and ${violations.length - 40} more`);
  }

  console.error('');
  console.error('Use workspace/workspaceId/workspaces for new code.');
  console.error('Only update scripts/workspace-terminology-baseline.json for an explicit legacy migration decision.');
}

function printStaleBaseline(staleBaseline) {
  console.error('Workspace terminology baseline is stale.');
  console.error('');
  console.error('Legacy project terminology was removed, so the baseline must be reduced too:');

  for (const entry of staleBaseline.slice(0, 40)) {
    console.error(
      `- ${entry.file}: ${entry.term} -${entry.removed} (${entry.current}/${entry.allowed})`
    );
  }

  if (staleBaseline.length > 40) {
    console.error(`- ...and ${staleBaseline.length - 40} more`);
  }

  console.error('');
  console.error('Run node scripts/check-workspace-terminology.mjs --write-baseline after reviewing the cleanup.');
}

const current = scanRepository();

if (writeBaseline) {
  current.generatedAt = new Date().toISOString();
  writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Wrote workspace terminology baseline with ${getTotal(current)} legacy terms.`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error('Missing scripts/workspace-terminology-baseline.json.');
  console.error('Run node scripts/check-workspace-terminology.mjs --write-baseline once from a clean legacy state.');
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const { violations, staleBaseline } = compareAgainstBaseline(current, baseline);

if (violations.length > 0) {
  printViolations(violations);
  process.exit(1);
}

if (staleBaseline.length > 0) {
  printStaleBaseline(staleBaseline);
  process.exit(1);
}

console.log(`Workspace terminology check passed (${getTotal(current)} legacy terms, no expansion).`);
