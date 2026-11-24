// AgentHub desktop app: shows AgentHub in a window and runs the connector in the background,
// so Codex and Claude Code jobs run on this computer with the person's own sign-in.
import { app, BrowserWindow, Menu, Notification, Tray, dialog, ipcMain, nativeImage, safeStorage, shell } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shellArgs, startConnector, VERSION as CONNECTOR_VERSION } from './connector.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SERVER = (process.env.AGENTHUB_SERVER || 'https://agenticprocess.io').replace(/\/+$/, '');
const SERVER_ORIGIN = new URL(SERVER).origin;
const IS_MAC = process.platform === 'darwin';
const IS_WINDOWS = process.platform === 'win32';

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
let tray = null;
let quitting = false;
let connector = null;
let status = { paired: false, state: 'not-paired', deviceId: null, report: null };

// ── logs and settings ──
const userDir = () => app.getPath('userData');
const logFile = () => path.join(userDir(), 'connector.log');
function log(...parts) {
  try {
    const file = logFile();
    if (fs.existsSync(file) && fs.statSync(file).size > 2_000_000) fs.renameSync(file, `${file}.old`);
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${parts.join(' ')}\n`);
  } catch { /* logging is best effort */ }
}

const pairingFile = () => path.join(userDir(), 'pairing.json');
/** The device key is encrypted with the system keychain when available. */
function savePairing(deviceId, key) {
  const secret = safeStorage.isEncryptionAvailable() ? { enc: safeStorage.encryptString(key).toString('base64') } : { plain: key };
  fs.mkdirSync(userDir(), { recursive: true });
  fs.writeFileSync(pairingFile(), JSON.stringify({ server: SERVER, deviceId, ...secret }), { mode: 0o600 });
}
function loadPairing() {
  try {
    const saved = JSON.parse(fs.readFileSync(pairingFile(), 'utf8'));
    if (saved.server !== SERVER) return null;
    const key = saved.enc ? safeStorage.decryptString(Buffer.from(saved.enc, 'base64')) : saved.plain;
    return key ? { deviceId: saved.deviceId, key } : null;
  } catch {
    return null;
  }
}
function clearPairing() { fs.rmSync(pairingFile(), { force: true }); }

// ── PATH: apps opened from Finder don't see the shell's PATH (npm, Homebrew, ~/.local/bin) ──
/** Runs in the background (at most 4 s) so a slow shell setup never delays the window. */
function fixPath() {
  const extra = IS_WINDOWS
    ? [path.join(process.env.APPDATA || '', 'npm'), path.join(os.homedir(), '.local', 'bin')]
    : ['/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.local', 'bin'), path.join(os.homedir(), '.npm-global', 'bin'), path.join(os.homedir(), '.claude', 'local')];
  const apply = shellPath => {
    const parts = [...shellPath.split(path.delimiter), ...(process.env.PATH || '').split(path.delimiter), ...extra].filter(Boolean);
    process.env.PATH = [...new Set(parts)].join(path.delimiter);
  };
  if (IS_WINDOWS) { apply(''); return Promise.resolve(); }
  return new Promise(resolve => {
    let out = '';
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      apply(out.match(/__AGENTHUB_PATH__(.*)__AGENTHUB_PATH__/)?.[1] ?? '');
      resolve();
    };
    try {
      const shellBin = process.env.SHELL || (IS_MAC ? '/bin/zsh' : '/bin/bash');
      const child = spawn(shellBin, ['-ilc', 'printf "__AGENTHUB_PATH__%s__AGENTHUB_PATH__" "$PATH"'], { stdio: ['ignore', 'pipe', 'ignore'] });
      child.stdout.on('data', data => { out += data; });
      child.on('close', finish);
      child.on('error', finish);
      setTimeout(() => { child.kill(); finish(); }, 4000);
    } catch {
      finish();
    }
  });
}

// ── sign-in and installs, shown the desktop way ──
function notify(title, body) {
  if (Notification.isSupported()) new Notification({ title, body, silent: true }).show();
}

/** Opens a terminal window running `claude`, where the person types /login. */
function openClaudeTerminal() {
  if (IS_MAC) {
    spawn('osascript', ['-e', 'tell application "Terminal" to activate', '-e', 'tell application "Terminal" to do script "claude"'], { detached: true, stdio: 'ignore' }).unref();
  } else if (IS_WINDOWS) {
    spawn('cmd.exe', ['/c', 'start', '"Claude Code"', 'cmd.exe', '/k', 'claude'], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
  } else {
    spawn('x-terminal-emulator', ['-e', 'claude'], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  }
}

function runQuietly(job) {
  return new Promise(resolve => {
    log(`Starting: ${job.title}`);
    const child = spawn(job.cmd, shellArgs(job.args), { shell: IS_WINDOWS, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const out = fs.createWriteStream(logFile(), { flags: 'a' });
    child.stdout.pipe(out, { end: false });
    child.stderr.pipe(out, { end: false });
    const timer = setTimeout(() => child.kill(), 15 * 60_000);
    const done = code => { clearTimeout(timer); out.end(); log(`Finished: ${job.title} (exit ${code})`); resolve(code); };
    child.on('close', done);
    child.on('error', () => done(null));
  });
}

async function interactive(job) {
  if (job.kind === 'login' && job.harness === 'claude') {
    openClaudeTerminal();
    notify('Sign in to Claude Code', 'In the Terminal window that opened, type /login, finish in your browser, then type /exit.');
    // The connector re-checks shortly; the person finishes at their own pace.
    setTimeout(() => connector?.check(), 60_000);
    setTimeout(() => connector?.check(), 180_000);
    return 0;
  }
  notify('AgentHub', `${job.title}…`);
  const code = await runQuietly(job);
  notify('AgentHub', code === 0 ? `${job.title.split(':')[0]}: done.` : `${job.title.split(':')[0]} failed. See Help → Open connector log.`);
  return code;
}

// ── connector ──
function setStatus(patch) {
  status = { ...status, ...patch };
  win?.webContents.send('agenthub:status', status);
  updateTray();
}

function startPairedConnector() {
  connector?.stop();
  const pairing = loadPairing();
  if (!pairing) { setStatus({ paired: false, state: 'not-paired', deviceId: null, report: null }); return; }
  setStatus({ paired: true, deviceId: pairing.deviceId, state: 'connecting' });
  connector = startConnector({
    server: SERVER, key: pairing.key, client: `desktop ${app.getVersion()}`, log,
    interactive,
    onStatus: next => {
      if (next.state === 'revoked') {
        clearPairing();
        connector = null;
        setStatus({ paired: false, state: 'not-paired', deviceId: null, report: null });
        return;
      }
      setStatus({ state: next.state, ...(next.report ? { report: next.report } : {}) });
    },
  });
}

// ── window ──
function isOurs(url) {
  try { return new URL(url).origin === SERVER_ORIGIN; } catch { return false; }
}
function openOutside(url) {
  try { if (['https:', 'http:', 'mailto:'].includes(new URL(url).protocol)) void shell.openExternal(url); } catch { /* ignore */ }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1320, height: 880, minWidth: 420, minHeight: 560, show: false, title: 'AgentHub',
    backgroundColor: '#faf8f4',
    icon: path.join(here, 'assets', 'icon.png'),
    webPreferences: { preload: path.join(here, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true },
  });
  if (!IS_MAC) { win.removeMenu(); addShortcuts(win); }
  const reveal = () => { if (win && !win.isVisible() && !process.argv.includes('--hidden')) win.show(); };
  win.once('ready-to-show', reveal);
  setTimeout(reveal, 3000);
  // Only AgentHub loads inside the app; every other link opens in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => { if (isOurs(url)) void win.loadURL(url); else openOutside(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (event, url) => { if (!isOurs(url)) { event.preventDefault(); openOutside(url); } });
  win.webContents.on('did-fail-load', (_e, code, description, url) => {
    if (code === -3 || !isOurs(url)) return; // -3: navigation replaced
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<body style="font:15px system-ui;background:#faf8f4;color:#282820;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h2>Can't reach AgentHub</h2><p style="color:#665f54">${description}. Check your internet connection.</p><button onclick="location.href='${SERVER}/login'" style="font:inherit;padding:10px 18px;border-radius:12px;border:0;background:#262922;color:#fff;cursor:pointer">Try again</button></div></body>`)}`);
  });
  win.on('close', event => { if (!quitting) { event.preventDefault(); win.hide(); } });
  void win.loadURL(`${SERVER}/login`);
}

/** Without a menu bar, keep the usual shortcuts: reload, zoom and full screen. Copy/paste work on their own. */
function addShortcuts(window) {
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control && !input.alt && !input.meta;
    const contents = window.webContents;
    let handled = true;
    if ((ctrl && input.key.toLowerCase() === 'r') || input.key === 'F5') contents.reload();
    else if (ctrl && (input.key === '=' || input.key === '+')) contents.setZoomLevel(Math.min(contents.getZoomLevel() + 0.5, 4));
    else if (ctrl && input.key === '-') contents.setZoomLevel(Math.max(contents.getZoomLevel() - 0.5, -3));
    else if (ctrl && input.key === '0') contents.setZoomLevel(0);
    else if (input.key === 'F11') window.setFullScreen(!window.isFullScreen());
    else handled = false;
    if (handled) event.preventDefault();
  });
}

function showWindow() {
  if (!win) createWindow();
  win.show();
  win.focus();
}

// ── tray / menu bar ──
function statusLine() {
  if (!status.paired) return 'Not connected: open AgentHub → Connections';
  if (status.state === 'online') return 'Connected: ready for jobs';
  if (status.state === 'offline') return 'Offline: retrying…';
  return 'Connecting…';
}

function updateTray() {
  if (!tray) return;
  const login = app.getLoginItemSettings();
  tray.setToolTip(`AgentHub: ${statusLine()}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: statusLine(), enabled: false },
    { type: 'separator' },
    { label: 'Open AgentHub', click: showWindow },
    { label: 'Check Codex and Claude Code again', enabled: Boolean(connector), click: () => connector?.check() },
    { type: 'separator' },
    { label: 'Start at login', type: 'checkbox', checked: login.openAtLogin, click: item => app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] }) },
    { label: 'Open connector log', click: () => void shell.openPath(logFile()) },
    { type: 'separator' },
    { label: 'Quit AgentHub', click: () => { quitting = true; app.quit(); } },
  ]));
}

function createTray() {
  const image = nativeImage.createFromPath(path.join(here, 'assets', IS_MAC ? 'trayTemplate.png' : 'tray.png'));
  if (IS_MAC) image.setTemplateImage(true);
  tray = new Tray(image);
  tray.on('click', () => { if (!IS_MAC) showWindow(); });
  updateTray();
}

function createAppMenu() {
  // Windows and Linux: no menu bar inside the window (shortcuts are handled in addShortcuts).
  // macOS keeps its menu in the system menu bar; it also provides Cmd+C/V/Q.
  if (!IS_MAC) { Menu.setApplicationMenu(null); return; }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(IS_MAC ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' }, { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
    { role: 'help', submenu: [{ label: 'Open connector log', click: () => void shell.openPath(logFile()) }, { label: `Connector ${CONNECTOR_VERSION}`, enabled: false }] },
  ]));
}

// ── bridge for the AgentHub page (only for the AgentHub site itself) ──
const fromAgentHub = event => event.senderFrame && event.senderFrame.origin === SERVER_ORIGIN && event.senderFrame === event.sender.mainFrame;

ipcMain.handle('agenthub:status', event => (fromAgentHub(event) ? status : null));
ipcMain.handle('agenthub:pair', (event, pairing) => {
  if (!fromAgentHub(event)) return { ok: false };
  const { deviceId, key } = pairing ?? {};
  if (typeof deviceId !== 'string' || !/^dev_[0-9a-f-]{36}$/.test(deviceId) || typeof key !== 'string' || !/^ahc_[A-Za-z0-9_-]{20,}$/.test(key)) return { ok: false };
  savePairing(deviceId, key);
  startPairedConnector();
  return { ok: true };
});
ipcMain.handle('agenthub:check', event => { if (fromAgentHub(event)) void connector?.check(); return true; });

// ── lifecycle ──
app.on('second-instance', showWindow);
app.on('activate', showWindow);
app.on('before-quit', () => { quitting = true; connector?.stop(); });
app.on('window-all-closed', () => { /* keep running in the tray */ });

// Startup errors go to the log and a message box, never a silent crash.
let errorShown = false;
function reportFatal(error) {
  log('Error:', error?.stack || String(error));
  if (errorShown || !app.isReady()) return;
  errorShown = true;
  dialog.showErrorBox('AgentHub hit a problem', `${error?.message || error}\n\nDetails are in the connector log (tray menu → Open connector log).`);
}
process.on('uncaughtException', reportFatal);
process.on('unhandledRejection', reportFatal);

app.whenReady().then(() => {
  log(`AgentHub ${app.getVersion()} starting on ${process.platform} ${process.arch} (connector ${CONNECTOR_VERSION}, server ${SERVER})`);
  createAppMenu();
  // The window comes first so something always appears.
  createWindow();
  try { createTray(); } catch (error) { log('Tray unavailable:', error.message); }
  // First launch: start at login by default (it can be switched off in the tray menu).
  const firstRun = path.join(userDir(), '.initialized');
  if (!fs.existsSync(firstRun)) {
    app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
    fs.writeFileSync(firstRun, '');
  }
  void fixPath().then(startPairedConnector);
}).catch(reportFatal);
