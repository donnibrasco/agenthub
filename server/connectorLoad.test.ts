import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// The desktop app imports the connector while process.argv[1] is an app flag, not a file.
// That used to throw during load, so the Mac app bounced in the Dock forever.
test('the connector loads when argv[1] is an app launch flag', () => {
  const file = path.resolve('connector/agenthub-connector.mjs');
  for (const flag of ['--no-sandbox', '--hidden', '-psn_0_12345']) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `process.argv[1] = ${JSON.stringify(flag)}; const m = await import(${JSON.stringify(file)}); console.log(typeof m.startConnector);`], { encoding: 'utf8', timeout: 20_000 });
    assert.equal(result.status, 0, `with ${flag}: ${result.stderr.split('\n').slice(0, 3).join(' ')}`);
    assert.equal(result.stdout.trim(), 'function');
  }
});
