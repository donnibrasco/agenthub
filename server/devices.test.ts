import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { NeuroDatabase } from './db.ts';
import { DeviceHub } from './devices.ts';
import { configureLocalAgents } from './localAgents.ts';
import { runPromptAgainstModel, probeModelEndpoint } from './modelProxy.ts';
import { localAgentEndpoint } from '../src/lib/modelConnection.ts';
import { registerAttachmentRoutes, linkAttachments, listJobAttachments } from './attachments.ts';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devices-test-'));
process.env.NEURONEST_DB_PATH = path.join(dir, 'db.sqlite');
const home = path.join(dir, 'home');
const bin = path.join(dir, 'bin');
fs.mkdirSync(home);
fs.mkdirSync(bin);

// Fake CLIs on the computer's PATH. They record what they were given.
fs.writeFileSync(path.join(bin, 'codex'), `#!/bin/sh
case "$1" in --version) echo "codex-cli 0.171.0"; exit 0;; login) echo "Logged in using ChatGPT"; exit 0;; esac
{ echo "ARGS: $*"; echo "STDIN: $(cat)"; env; } > "${dir}/codex-run.txt"
echo '{"type":"item.completed","item":{"id":"r","type":"reasoning","text":"Checking"}}'
echo '{"type":"item.completed","item":{"id":"m","type":"agent_message","text":"Hello from **this computer**"}}'
echo '{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5}}'
`, { mode: 0o755 });
fs.writeFileSync(path.join(bin, 'claude'), `#!/bin/sh
case "$1" in --version) echo "2.1.319 (Claude Code)"; exit 0;; esac
{ echo "ARGS: $*"; echo "PWD: $(pwd)"; ls attachments | sed 's/^/FILE: /'; echo "STDIN: $(cat)"; } > "${dir}/claude-run.txt"
echo '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t1","name":"Read","input":{"file_path":"attachments/notes.md"}}]}}'
echo '{"type":"result","subtype":"success","is_error":false,"result":"Read your notes.","usage":{"input_tokens":3,"output_tokens":2}}'
`, { mode: 0o755 });
fs.writeFileSync(path.join(bin, 'npm'), '#!/bin/sh\necho 9.9.9\n', { mode: 0o755 });
fs.mkdirSync(path.join(home, '.claude'));
fs.writeFileSync(path.join(home, '.claude', '.credentials.json'), '{}');

let connector: ChildProcess | undefined;
test.after(() => { connector?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

const until = async (check: () => boolean, ms = 15_000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise(r => setTimeout(r, 100));
  }
};

test('a computer pairs, reports, and runs Codex and Claude jobs through the real connector', { timeout: 60_000 }, async () => {
  const db = new NeuroDatabase(':memory:');
  const hub = new DeviceHub(db);
  configureLocalAgents(hub);
  const app = express();
  app.use(express.json());
  hub.registerRoutes(app);
  registerAttachmentRoutes(app, db);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const { deviceId, key } = (await fetch(`${base}/api/devices`, { method: 'POST' }).then(r => r.json())) as { deviceId: string; key: string };
    assert.match(key, /^ahc_/);
    assert.equal((await fetch(`${base}/api/connector/poll`, { headers: { Authorization: 'Bearer ahc_wrongwrongwrongwrongwrong' } })).status, 401);

    process.env.NEURONEST_SECRET = 'server-secret-value';
    connector = spawn(process.execPath, ['connector/agenthub-connector.mjs', '--server', base, '--key', key], {
      env: { PATH: `${bin}:${process.env.PATH}`, HOME: home }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    connector.stdout!.on('data', d => { output += d; });
    connector.stderr!.on('data', d => { output += d; });

    await until(() => Boolean(hub.get(deviceId)?.report.harnesses));
    const device = hub.get(deviceId)!;
    assert.equal(device.online, true);
    assert.equal(device.name, os.hostname());
    assert.deepEqual(device.report.harnesses?.codex, { installed: true, version: '0.171.0', signedIn: true, latest: '9.9.9' });
    assert.equal(device.report.harnesses?.claude?.signedIn, true);
    const saved = JSON.parse(fs.readFileSync(path.join(home, '.agenthub', 'config.json'), 'utf8'));
    assert.equal(saved.key, key, 'the connector remembers its key for later runs');

    const codexEndpoint = localAgentEndpoint('Codex CLI', deviceId);
    assert.equal((await probeModelEndpoint(codexEndpoint, 'Codex CLI')).reachable, true);
    const steps: number[] = [];
    const codex = await runPromptAgainstModel({ endpointUrl: codexEndpoint, provider: 'Codex CLI', modelId: 'default', promptText: 'Say hi', onSteps: s => steps.push(s.length) });
    assert.equal(codex.ok, true, codex.error);
    assert.equal(codex.output, 'Hello from **this computer**');
    assert.deepEqual(codex.steps, [{ kind: 'thinking', text: 'Checking' }]);
    const codexSeen = fs.readFileSync(path.join(dir, 'codex-run.txt'), 'utf8');
    assert.match(codexSeen, /ARGS: --search exec --skip-git-repo-check --ephemeral --sandbox read-only/);
    assert.match(codexSeen, /STDIN: Say hi/);
    assert.doesNotMatch(codexSeen, /server-secret-value/, 'server secrets never reach the computer');

    // A Claude job with a text attachment: the file is downloaded into the job folder.
    const up = await fetch(`${base}/api/uploads`, { method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-file-name': 'notes.md' }, body: '# Notes\n' }).then(r => r.json());
    linkAttachments(db, 'job_1', [up.attachment.id]);
    const claude = await runPromptAgainstModel({ endpointUrl: localAgentEndpoint('Claude Code', deviceId), provider: 'Claude Code', modelId: 'sonnet', promptText: 'Summarize', attachments: listJobAttachments(db, 'job_1') });
    assert.equal(claude.ok, true, claude.error);
    assert.equal(claude.output, 'Read your notes.');
    assert.deepEqual(claude.steps, [{ kind: 'read', path: 'attachments/notes.md' }]);
    const claudeSeen = fs.readFileSync(path.join(dir, 'claude-run.txt'), 'utf8');
    assert.match(claudeSeen, /--disallowedTools Bash,BashOutput,KillShell,Edit,MultiEdit,Write,NotebookEdit/);
    assert.match(claudeSeen, /--model sonnet/);
    assert.match(claudeSeen, /FILE: notes\.md/);
    assert.match(claudeSeen, /STDIN: Summarize[\s\S]*attachments\/notes\.md/);
    assert.equal(fs.existsSync(claudeSeen.match(/PWD: (.*)/)![1]), false, 'job folder deleted');

    // Removing the computer stops the connector.
    await fetch(`${base}/api/devices/${deviceId}`, { method: 'DELETE' });
    await until(() => connector!.exitCode !== null);
    assert.match(output, /no longer recognises this computer/);
    const offline = await runPromptAgainstModel({ endpointUrl: codexEndpoint, provider: 'Codex CLI', modelId: 'default', promptText: 'x' });
    assert.match(offline.error ?? '', /not linked to a computer/);
  } finally {
    server.close();
  }
});
