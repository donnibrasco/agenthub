import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Production runs `node server.ts` with Node's built-in type stripping, which rejects some
// TypeScript-only syntax (enums, parameter properties, namespaces) that tsx accepts in tests.
test('every server module loads in plain Node, as in production', { skip: !process.features.typescript && 'this Node build has no TypeScript support; the Docker build runs scripts/check-server-modules.mjs instead' }, () => {
  const files = fs.readdirSync('server').filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'createAdmin.ts').map(f => `./server/${f}`);
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--no-warnings', '--experimental-strip-types', '--input-type=module', '-e', `await import(${JSON.stringify(path.resolve(file))})`], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, `${file} failed to load:\n${result.stderr.split('\n').slice(0, 4).join('\n')}`);
  }
});
