export type Harness = 'codex' | 'claude';

export interface HarnessReport {
  installed: boolean;
  version?: string;
  latest?: string;
  signedIn?: boolean;
}

export interface Device {
  id: string;
  name: string;
  platform: string;
  connectorVersion: string;
  createdAt: string;
  lastSeenAt: string | null;
  online: boolean;
  paired: boolean;
  report: { node?: string; activity?: string; harnesses?: Partial<Record<Harness, HarnessReport>> };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${res.status})`);
  return data as T;
}

export const listDevices = () => call<{ devices: Device[] }>('/api/devices').then(d => d.devices);
export const pairDevice = () => call<{ deviceId: string; key: string }>('/api/devices', { method: 'POST' });
export const removeDevice = (id: string) => call(`/api/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const deviceAction = (id: string, action: 'install' | 'update' | 'login' | 'check', harness?: Harness) =>
  call(`/api/devices/${encodeURIComponent(id)}/actions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, harness }) });

/** Simple dotted-version comparison: is `latest` newer than `current`? */
export function isNewer(latest?: string, current?: string) {
  if (!latest || !current) return false;
  const a = latest.split(/[.-]/).map(n => parseInt(n, 10) || 0);
  const b = current.split(/[.-]/).map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
}

export function setupCommands(server: string, key: string) {
  return {
    unix: `curl -fsSL ${server}/connector/agenthub-connector.mjs -o ~/agenthub-connector.mjs && node ~/agenthub-connector.mjs --server ${server} --key ${key}`,
    windows: `iwr ${server}/connector/agenthub-connector.mjs -OutFile $HOME\\agenthub-connector.mjs; node $HOME\\agenthub-connector.mjs --server ${server} --key ${key}`,
    restartUnix: 'node ~/agenthub-connector.mjs',
    restartWindows: 'node $HOME\\agenthub-connector.mjs',
  };
}

/** Present only inside the AgentHub desktop app (see desktop/preload.cjs). */
export interface DesktopBridge {
  platform: string;
  getStatus: () => Promise<{ paired: boolean; state: string; deviceId: string | null } | null>;
  pair: (deviceId: string, key: string) => Promise<{ ok: boolean }>;
  checkAgain: () => Promise<boolean>;
  onStatus: (callback: (status: { paired: boolean; state: string; deviceId: string | null }) => void) => () => void;
}

export const desktopBridge = (): DesktopBridge | undefined => (window as unknown as { agenthubDesktop?: DesktopBridge }).agenthubDesktop;
