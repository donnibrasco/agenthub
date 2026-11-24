#!/usr/bin/env node
// AgentHub Connector — runs Codex and Claude Code jobs for AgentHub on this computer.
//
//   First run:  node agenthub-connector.mjs --server https://your-agenthub --key ahc_…
//   Later:      node agenthub-connector.mjs
//
// The server only sends structured requests (run a job, install, sign in, check). This program
// builds every command itself and only ever starts `codex`, `claude`, or their installers.
// Jobs run read-only in a fresh temporary folder that is deleted afterwards.
// The AgentHub desktop app embeds this same file and calls startConnector().

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const VERSION = '1.2.0';
const IS_WINDOWS = process.platform === 'win32';
const MAX_RUNS = 2;
const PACKAGES = { codex: '@openai/codex', claude: '@anthropic-ai/claude-code' };
const NAMES = { codex: 'Codex', claude: 'Claude Code' };
const CLAUDE_DISALLOWED = 'Bash,BashOutput,KillShell,Edit,MultiEdit,Write,NotebookEdit,Task,SlashCommand';

/** Windows needs the shell to find npm/codex/claude (.cmd files), so quote arguments with spaces. */
export const shellArgs = args => (IS_WINDOWS ? args.map(a => (/[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)) : args);

function run(cmd, args, timeout = 15_000) {
  const result = spawnSync(cmd, shellArgs(args), { encoding: 'utf8', timeout, shell: IS_WINDOWS, windowsHide: true });
  return { ok: result.status === 0, out: `${result.stdout || ''}${result.stderr || ''}`.trim() };
}

function safeName(name) {
  return path.basename(String(name)).replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_').replace(/^\.+/, '').slice(0, 120) || 'file';
}

function claudeSignedIn() {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY) return true;
  if (process.platform === 'darwin') return run('security', ['find-generic-password', '-s', 'Claude Code-credentials'], 5000).ok;
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return fs.existsSync(path.join(configDir, '.credentials.json'));
}

/** Jobs are one-off; drop Claude Code's saved transcript for the temporary folder. */
function removeClaudeTranscript(dir) {
  const projects = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
  try {
    for (const entry of fs.readdirSync(projects)) if (entry.includes(path.basename(dir))) fs.rmSync(path.join(projects, entry), { recursive: true, force: true });
  } catch { /* nothing saved */ }
}

/**
 * Connects to AgentHub and handles work until stopped.
 * @param {{ server: string, key: string, client?: string,
 *   log?: (...parts: unknown[]) => void,
 *   onStatus?: (status: { state: 'online' | 'offline' | 'revoked', report?: object, error?: string }) => void,
 *   interactive?: (task: { kind: 'install' | 'update' | 'login', harness: 'codex' | 'claude', cmd: string, args: string[], title: string }) => Promise<number | null> }} options
 */
export function startConnector(options) {
  const server = options.server.replace(/\/+$/, '');
  const log = options.log ?? (() => {});
  let stopped = false;
  let activity = '';
  const running = new Map();
  const latestCache = {};

  async function api(method, route, body) {
    const res = await fetch(`${server}${route}`, {
      method,
      headers: { Authorization: `Bearer ${options.key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      stopped = true;
      options.onStatus?.({ state: 'revoked' });
      throw new Error('AgentHub no longer recognises this computer.');
    }
    return res;
  }

  function latestVersion(harness) {
    const cached = latestCache[harness];
    if (cached && Date.now() - cached.at < 6 * 3600_000) return cached.version;
    const result = run('npm', ['view', PACKAGES[harness], 'version'], 20_000);
    const version = result.ok ? result.out.split('\n').pop().trim() : undefined;
    latestCache[harness] = { version, at: Date.now() };
    return version;
  }

  function detect() {
    const harnesses = {};
    const codex = run('codex', ['--version']);
    const codexLogin = codex.ok ? run('codex', ['login', 'status']).out : '';
    harnesses.codex = codex.ok
      ? { installed: true, version: codex.out.match(/\d+\.\d+\.\d+[\w.-]*/)?.[0], signedIn: /logged in/i.test(codexLogin) && !/not logged in/i.test(codexLogin), latest: latestVersion('codex') }
      : { installed: false, latest: latestVersion('codex') };
    const claude = run('claude', ['--version']);
    harnesses.claude = claude.ok
      ? { installed: true, version: claude.out.match(/\d+\.\d+\.\d+[\w.-]*/)?.[0], signedIn: claudeSignedIn(), latest: latestVersion('claude') }
      : { installed: false, latest: latestVersion('claude') };
    const platform = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[process.platform] || process.platform;
    const npm = run('npm', ['--version']).ok;
    return { hostname: os.hostname(), platform, connectorVersion: VERSION, client: options.client ?? 'terminal', node: npm ? process.versions.node : undefined, npm, harnesses };
  }

  async function report() {
    try {
      const detected = detect();
      await api('POST', '/api/connector/report', { ...detected, activity });
      options.onStatus?.({ state: 'online', report: detected });
    } catch (error) {
      if (!stopped) { options.onStatus?.({ state: 'offline', error: error.message }); log('Could not reach AgentHub:', error.message); }
    }
  }

  async function runJob(command) {
    const { harness, model, prompt, files = [] } = command.payload;
    if (!PACKAGES[harness] || typeof prompt !== 'string') throw new Error('Unknown job.');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agenthub-job-'));
    try {
      const fileDir = harness === 'claude' ? path.join(dir, 'attachments') : dir;
      fs.mkdirSync(fileDir, { recursive: true });
      const images = [];
      for (const file of files) {
        const res = await api('GET', `/api/connector/commands/${command.id}/files/${encodeURIComponent(file.id)}`);
        if (!res.ok) continue;
        const target = path.join(fileDir, safeName(file.name));
        fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
        if (file.kind === 'image') images.push(target);
      }
      const chosenModel = typeof model === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(model) && model !== 'default' ? model : null;
      const args = harness === 'codex'
        ? ['--search', 'exec', '--skip-git-repo-check', '--ephemeral', '--sandbox', 'read-only', '--color', 'never', '--json',
          '-c', 'model_reasoning_summary=detailed', ...images.flatMap(image => ['-i', image]), '-C', dir, ...(chosenModel ? ['-m', chosenModel] : []), '-']
        : ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'default', '--max-turns', '40',
          '--allowedTools', 'WebSearch,WebFetch', '--disallowedTools', CLAUDE_DISALLOWED, ...(chosenModel ? ['--model', chosenModel] : [])];

      log(`Running a ${NAMES[harness]} job…`);
      const child = spawn(harness, shellArgs(args), { cwd: dir, shell: IS_WINDOWS, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      running.set(command.id, child);
      let pending = '';
      let stderr = '';
      const flush = async () => {
        if (!pending) return;
        const chunk = pending;
        pending = '';
        await api('POST', `/api/connector/commands/${command.id}/output`, { chunk }).catch(() => {});
      };
      const timer = setInterval(() => { void flush(); }, 400);
      child.stdout.on('data', data => { pending += data; });
      child.stderr.on('data', data => { stderr = (stderr + data).slice(-4000); });
      child.stdin.on('error', () => {});
      child.stdin.end(prompt);
      const exitCode = await new Promise(resolve => { child.on('close', resolve); child.on('error', () => resolve(null)); });
      clearInterval(timer);
      await flush();
      running.delete(command.id);
      log(`${NAMES[harness]} job ${exitCode === 0 ? 'finished' : `ended (exit ${exitCode})`}.`);
      return { exitCode, stderr };
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
      if (harness === 'claude') removeClaudeTranscript(dir);
    }
  }

  /** The fixed install/sign-in commands. Nothing here comes from the server. */
  /**
   * The fixed install/sign-in commands. Nothing here comes from the server.
   * `shell` is only for npm/codex/claude, which are .cmd files on Windows; PowerShell and bash
   * are started directly so their arguments reach them unchanged.
   */
  function task(kind, harness) {
    const verb = kind === 'install' ? 'Installing' : 'Updating';
    if (kind === 'login') {
      return harness === 'codex'
        ? { kind, harness, cmd: 'codex', args: ['login'], shell: IS_WINDOWS, title: 'Sign in to Codex: finish in the browser window that opens' }
        : { kind, harness, cmd: 'claude', args: [], shell: IS_WINDOWS, title: 'Claude Code sign-in: type /login, finish in your browser, then type /exit' };
    }
    const pkg = `${PACKAGES[harness]}@latest`;
    if (run('npm', ['--version']).ok) return { kind, harness, cmd: 'npm', args: ['install', '-g', pkg], shell: IS_WINDOWS, title: `${verb} ${NAMES[harness]}` };
    // Claude Code has an official installer that doesn't need Node.js.
    if (harness === 'claude') {
      return IS_WINDOWS
        ? { kind, harness, cmd: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://claude.ai/install.ps1 | iex'], shell: false, title: `${verb} Claude Code` }
        : { kind, harness, cmd: 'bash', args: ['-c', 'curl -fsSL https://claude.ai/install.sh | bash'], shell: false, title: `${verb} Claude Code` };
    }
    // Codex needs Node.js. Install it with the system's package manager when there is one.
    if (IS_WINDOWS && run('winget', ['--version']).ok) {
      const script = [
        'winget install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements',
        "$env:Path = $env:ProgramFiles + '\\nodejs;' + $env:APPDATA + '\\npm;' + $env:Path",
        `npm install -g ${pkg}`,
        'exit $LASTEXITCODE',
      ].join('; ');
      return { kind, harness, cmd: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], shell: false, title: `${verb} Node.js and Codex` };
    }
    if (!IS_WINDOWS && run('brew', ['--version']).ok) {
      return { kind, harness, cmd: 'bash', args: ['-c', `brew install node && npm install -g ${pkg}`], shell: false, title: `${verb} Node.js and Codex` };
    }
    return null;
  }

  async function handle(command) {
    const { type, payload = {} } = command;
    const harness = payload.harness;
    let result = { exitCode: 0 };
    try {
      if (type === 'run') {
        result = await runJob(command);
      } else if (type === 'cancel') {
        running.get(payload.commandId)?.kill();
        return;
      } else if ((type === 'install' || type === 'update' || type === 'login') && PACKAGES[harness]) {
        const job = task(type, harness);
        if (!job) {
          result = { exitCode: null, error: 'Codex needs Node.js. Install the LTS version from nodejs.org on this computer, then click Install again.' };
        } else {
          activity = job.title.split(':')[0];
          void report();
          // Hosts return an exit code, or { exitCode, detail } with the last lines of output.
          const outcome = options.interactive ? await options.interactive(job) : null;
          const code = typeof outcome === 'number' || outcome === null ? outcome : outcome.exitCode;
          const detail = outcome && typeof outcome === 'object' && outcome.detail ? `: ${outcome.detail}` : '.';
          result = { exitCode: code, error: code === 0 ? undefined : `${job.title.split(':')[0]} failed${detail}` };
        }
      } else if (type !== 'check') {
        result = { exitCode: null, error: 'Unknown request.' };
      }
    } catch (error) {
      result = { exitCode: null, error: error.message };
    } finally {
      activity = '';
    }
    await api('POST', `/api/connector/commands/${command.id}/done`, result).catch(() => {});
    if (type !== 'run') await report();
  }

  async function loop() {
    await report();
    const timer = setInterval(() => { if (!stopped) void report(); }, 60_000);
    let failures = 0;
    while (!stopped) {
      try {
        const res = await api('GET', '/api/connector/poll');
        failures = 0;
        if (res.status === 200) {
          const { command } = await res.json();
          if (command.type === 'run' && running.size >= MAX_RUNS) {
            await api('POST', `/api/connector/commands/${command.id}/done`, { exitCode: null, error: 'This computer is already running two jobs.' });
          } else {
            void handle(command);
          }
        }
      } catch (error) {
        if (stopped) break;
        failures++;
        options.onStatus?.({ state: 'offline', error: error.message });
        log('Connection problem, retrying:', error.message);
        await new Promise(resolve => setTimeout(resolve, Math.min(30_000, 1000 * 2 ** Math.min(failures, 5))));
      }
    }
    clearInterval(timer);
  }

  void loop();
  return {
    stop() { stopped = true; for (const child of running.values()) child.kill(); },
    check: () => report(),
  };
}

// ── Command-line use ──
function cliMain() {
  const configDir = path.join(os.homedir(), '.agenthub');
  const configFile = path.join(configDir, 'config.json');
  const args = process.argv.slice(2);
  const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch { /* first run */ }
  const server = (flag('--server') || saved.server || '').replace(/\/+$/, '');
  const key = flag('--key') || saved.key;
  if (!server || !key) {
    console.error('AgentHub Connector is not set up yet.\nCopy the command from AgentHub → Connections → Add a computer.');
    process.exit(1);
  }
  if (!/^https?:\/\//.test(server) || !/^ahc_[A-Za-z0-9_-]{20,}$/.test(key)) {
    console.error('The --server or --key value looks wrong. Copy the command again from AgentHub.');
    process.exit(1);
  }
  if (flag('--server') || flag('--key')) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(configFile, JSON.stringify({ server, key }, null, 2), { mode: 0o600 });
  }

  let quiet = false; // while an installer or sign-in owns the terminal
  const log = (...parts) => { if (!quiet) console.log(`[${new Date().toLocaleTimeString()}]`, ...parts); };
  console.log(`AgentHub Connector ${VERSION} — connected to ${server}`);
  console.log('Keep this window open to run Codex and Claude Code jobs from AgentHub. Press Ctrl+C to stop.\n');
  startConnector({
    server, key, log,
    onStatus: status => {
      if (status.state === 'revoked') {
        console.error('\nAgentHub no longer recognises this computer (it was removed). Add it again from Connections.');
        process.exit(2);
      }
    },
    interactive: job => new Promise(resolve => {
      quiet = true;
      console.log(`\n── ${job.title} ──`);
      const child = spawn(job.cmd, job.shell ? shellArgs(job.args) : job.args, { stdio: 'inherit', shell: job.shell });
      const done = code => {
        quiet = false;
        console.log(`── done (${code === 0 ? 'ok' : `exit ${code}`}) ──\n`);
        if (code !== 0 && job.cmd === 'npm') console.log(IS_WINDOWS ? 'Tip: run this terminal as Administrator, or install Node.js with nvm-windows.' : `Tip: for a permissions error, install Node.js with nvm or run: sudo npm install -g ${job.args[2]}`);
        resolve(code);
      };
      child.on('close', done);
      child.on('error', () => done(null));
    }),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) cliMain();
