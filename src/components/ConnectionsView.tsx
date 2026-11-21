import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, ArrowUpCircle, Bot, Check, CheckCircle2, Copy, KeyRound, Laptop, Loader2, Plug, Plus, RefreshCw, Sparkles, SquareTerminal, X } from 'lucide-react';
import { useNeuro, type NeuroAgent } from '../context/NeuroContext';
import { desktopBridge, deviceAction, isNewer, listDevices, pairDevice, removeDevice, setupCommands, type Device, type Harness } from '../lib/devices';
import { isLocalAgentProvider, localAgentEndpoint, parseLocalAgentEndpoint, type ModelProvider } from '../lib/modelConnection';
import { useEscapeKey } from '../lib/useEscapeKey';
import { copyText } from './Markdown';

const HARNESSES: { id: Harness; name: string; provider: ModelProvider; account: string; Icon: typeof Bot; tile: string }[] = [
  { id: 'codex', name: 'Codex', provider: 'Codex CLI', account: 'ChatGPT', Icon: SquareTerminal, tile: 'bg-[#282820] text-white' },
  { id: 'claude', name: 'Claude Code', provider: 'Claude Code', account: 'Claude', Icon: Sparkles, tile: 'bg-[#d97757] text-white' },
];

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const fullDate = new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' });

function ago(iso?: string | null) {
  const time = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(time)) return '';
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return fullDate.format(time);
}

type Tone = 'ok' | 'warn' | 'muted' | 'busy' | 'bad';
function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const styles: Record<Tone, string> = {
    ok: 'border-[#166b66]/25 bg-[#e9f2eb] text-[#1f6b5f]',
    warn: 'border-[#987529]/30 bg-[#f7eed7] text-[#6d551d]',
    muted: 'border-dashed border-[#cfc8bb] text-[#777064]',
    busy: 'border-[#2f5d8a]/25 bg-[#e8eef6] text-[#2f5d8a]',
    bad: 'border-[#a44e32]/25 bg-[#f9ece4] text-[#922d1d]',
  };
  const Icon = { ok: CheckCircle2, warn: ArrowUpCircle, muted: AlertCircle, busy: Loader2, bad: AlertCircle }[tone];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${styles[tone]}`}>
      <Icon aria-hidden="true" className={`size-3.5 ${tone === 'busy' ? 'motion-safe:animate-spin' : ''}`} /> {children}
    </span>
  );
}

function SectionTitle({ title, count, children }: { title: string; count: number; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span aria-hidden="true" className="h-0.5 w-6 rounded-full bg-[#08666c]" />
      <h2 className="text-xs font-semibold tracking-[0.12em] text-[#665f54] uppercase">{title}</h2>
      <span className="ml-auto text-sm text-[#8a8478] tabular-nums">{count}</span>
      {children}
    </div>
  );
}

function CommandBox({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-[#665f54]">{label}</p>
      <div className="flex items-start gap-2 rounded-xl border border-[#e7e2d9] bg-[#f6f3ed] p-2 pl-3">
        <code className="min-w-0 flex-1 font-mono text-[12.5px] leading-relaxed break-all text-[#282820]">{command}</code>
        <button type="button" onClick={async () => { if (await copyText(command)) { setCopied(true); window.setTimeout(() => setCopied(false), 1500); } }}
          className="workspace-button min-h-8 shrink-0 px-2.5 text-xs">
          {copied ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

/** Pairing: shows the one-time setup command and waits for the computer to connect. */
function AddComputerDialog({ onClose, onConnected }: { onClose: () => void; onConnected: () => void }) {
  const [pairing, setPairing] = useState<{ deviceId: string; key: string } | null>(null);
  const [os, setOs] = useState<'unix' | 'windows'>(/Win/i.test(navigator.platform) ? 'windows' : 'unix');
  const [connected, setConnected] = useState<Device | null>(null);
  const [error, setError] = useState('');
  useEscapeKey(true, onClose);

  useEffect(() => { pairDevice().then(setPairing).catch(err => setError(err instanceof Error ? err.message : 'Could not create a setup command.')); }, []);
  useEffect(() => {
    if (!pairing || connected) return;
    const timer = window.setInterval(async () => {
      const device = (await listDevices().catch(() => [])).find(d => d.id === pairing.deviceId);
      if (device?.paired) { setConnected(device); onConnected(); }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [pairing, connected, onConnected]);

  const commands = pairing ? setupCommands(window.location.origin, pairing.key) : null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="add-computer-title" className="fixed inset-0 z-50 grid place-items-center bg-[#26251e]/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-3xl border border-[#e7e2d9] bg-[#fffdfa] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="add-computer-title" className="text-xl font-semibold tracking-tight">Add a computer</h2>
            <p className="mt-1 text-sm text-[#665f54]">Codex and Claude Code will run on it with your own sign-in. Jobs from AgentHub run there and stream back here.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-[#665f54] hover:bg-[#ede9e0]"><X aria-hidden="true" className="size-5" /></button>
        </div>

        {connected ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 rounded-2xl border border-[#166b66]/25 bg-[#e9f2eb] p-4 font-medium text-[#1f6b5f]"><CheckCircle2 aria-hidden="true" className="size-5" /> {connected.name} is connected.</p>
            <p className="text-sm text-[#4b4941]">Keep the connector window open while you use AgentHub. Next time, start it with <code className="font-mono">{os === 'windows' ? commands!.restartWindows : commands!.restartUnix}</code>.</p>
            <button type="button" onClick={onClose} className="workspace-primary">Done</button>
          </div>
        ) : (
          <>
            <ol className="space-y-4 text-sm text-[#4b4941]">
              <li>
                <span className="font-semibold text-[#282820]">1. Make sure Node.js 18 or newer is installed</span> on that computer (from <span className="font-medium">nodejs.org</span>). Codex and Claude Code need it too.
              </li>
              <li className="space-y-2">
                <span className="font-semibold text-[#282820]">2. Open a terminal on that computer and run:</span>
                <div role="tablist" aria-label="Operating system" className="flex gap-1.5">
                  {(['unix', 'windows'] as const).map(id => (
                    <button key={id} type="button" role="tab" aria-selected={os === id} onClick={() => setOs(id)}
                      className={`rounded-lg px-3 py-1 text-xs font-medium transition ${os === id ? 'bg-[#08666c] text-white' : 'border border-[#e7e2d9] text-[#665f54] hover:bg-[#ede9e0]'}`}>
                      {id === 'unix' ? 'macOS / Linux' : 'Windows (PowerShell)'}
                    </button>
                  ))}
                </div>
                {commands ? <CommandBox label="Setup command (contains this computer's private key — don't share it)" command={os === 'windows' ? commands.windows : commands.unix} />
                  : !error && <p className="flex items-center gap-2 text-[#665f54]"><Loader2 aria-hidden="true" className="size-4 animate-spin" /> Creating a setup command…</p>}
              </li>
              <li><span className="font-semibold text-[#282820]">3. Leave that window open.</span> Then install and sign in to Codex or Claude Code from this page.</li>
            </ol>
            {pairing && <p role="status" className="flex items-center gap-2 text-sm text-[#665f54]"><Loader2 aria-hidden="true" className="size-4 animate-spin" /> Waiting for the computer to connect…</p>}
          </>
        )}
        {error && <p role="alert" className="text-sm text-[#922d1d]">{error}</p>}
      </div>
    </div>
  );
}

function AgentRow({ agent, label, onRevoke }: { agent: NeuroAgent; label: string; onRevoke: () => void }) {
  const added = agent.createdAt ? dateFormat.format(Date.parse(agent.createdAt)) : agent.date;
  const used = agent.lastPingAt && !Number.isNaN(Date.parse(agent.lastPingAt)) ? `Last used ${ago(agent.lastPingAt)}` : 'Never used';
  const inUse = agent.tokens > 0 || agent.status === 'Active';
  return (
    <li className="flex flex-wrap items-center gap-3 py-3 pl-4 sm:pl-14">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#e7e2d9] bg-[#f6f3ed] text-[#665f54]"><KeyRound aria-hidden="true" className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[#282820]">{agent.name}</p>
        <p className="truncate text-xs text-[#8a8478]">{label} · {agent.model || 'default'} · Added {added} · {used}</p>
      </div>
      <Pill tone={inUse ? 'ok' : 'muted'}>{inUse ? 'In use' : 'Not used yet'}</Pill>
      <button type="button" onClick={onRevoke} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#665f54] transition hover:bg-[#f9ece4] hover:text-[#922d1d]">Revoke</button>
    </li>
  );
}

function harnessState(device: Device, harness: Harness, busyKey: string | null) {
  const report = device.report.harnesses?.[harness];
  const activity = device.report.activity ?? '';
  const name = HARNESSES.find(h => h.id === harness)!.name;
  if (busyKey === `${device.id}:${harness}` || activity.includes(name)) return { tone: 'busy' as Tone, label: activity || 'Working…', action: null };
  if (!device.online) return { tone: 'muted' as Tone, label: 'Computer offline', action: null };
  if (!report?.installed) return { tone: 'muted' as Tone, label: 'Not installed', action: 'install' as const };
  if (report.signedIn === false) return { tone: 'warn' as Tone, label: 'Not signed in', action: 'login' as const };
  if (isNewer(report.latest, report.version)) return { tone: 'warn' as Tone, label: 'Update available', action: 'update' as const };
  return { tone: 'ok' as Tone, label: 'Ready', action: null };
}

export function ConnectionsView({ onNewChat }: { onNewChat: () => void }) {
  const { agents, connectModel, disconnectModel, setEditingModel, setIsConnectModalOpen } = useNeuro();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body: string; run: () => Promise<void> } | null>(null);
  const [notice, setNotice] = useState('');
  const desktop = desktopBridge();
  const [desktopStatus, setDesktopStatus] = useState<{ paired: boolean; state: string; deviceId: string | null } | null>(null);
  const [pairingThis, setPairingThis] = useState(false);

  useEffect(() => {
    if (!desktop) return;
    void desktop.getStatus().then(setDesktopStatus);
    return desktop.onStatus(setDesktopStatus);
  }, [desktop]);

  async function connectThisComputer() {
    if (!desktop) return;
    setPairingThis(true);
    setNotice('');
    try {
      const { deviceId, key } = await pairDevice();
      const result = await desktop.pair(deviceId, key);
      if (!result.ok) throw new Error('The desktop app did not accept the connection.');
      setNotice('This computer is connected. Install or sign in to Codex and Claude Code below.');
      window.setTimeout(() => void refresh(), 2500);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not connect this computer.');
    } finally {
      setPairingThis(false);
    }
  }

  const refresh = useCallback(async () => {
    try { setDevices(await listDevices()); setCheckedAt(Date.now()); } catch (err) { setNotice(err instanceof Error ? err.message : 'Could not load computers.'); }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function act(device: Device, action: 'install' | 'update' | 'login' | 'check', harness?: Harness) {
    setNotice('');
    setBusyKey(harness ? `${device.id}:${harness}` : device.id);
    try {
      await deviceAction(device.id, action, harness);
      if (action === 'login') setNotice(`Finish signing in on ${device.name}: ${harness === 'codex' ? 'a browser window opens there' : 'type /login in the connector window, then /exit'}.`);
      if (action === 'install' || action === 'update') setNotice(`Installing on ${device.name}. Progress shows in its connector window.`);
      window.setTimeout(() => { setBusyKey(null); void refresh(); }, 3000);
    } catch (err) {
      setBusyKey(null);
      setNotice(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  async function addAgent(device: Device, harness: (typeof HARNESSES)[number]) {
    try {
      await connectModel({
        name: `${harness.name} on ${device.name}`, provider: harness.provider, modelId: 'default',
        endpointUrl: localAgentEndpoint(harness.provider, device.id), runtime: 'Local Workstation', category: 'Engineering',
        description: `${harness.name} running on ${device.name} with your ${harness.account} account.`,
      });
      setNotice(`${harness.name} on ${device.name} is ready. Pick it in New chat.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not add the agent.');
    }
  }

  const localAgents = agents.filter(a => isLocalAgentProvider(a.provider));
  const apiAgents = agents.filter(a => !isLocalAgentProvider(a.provider));
  const deviceAgents = (deviceId: string, provider: ModelProvider) => localAgents.filter(a => a.provider === provider && parseLocalAgentEndpoint(a.endpointUrl || '') === deviceId);
  const orphanAgents = localAgents.filter(a => !devices?.some(d => d.id === parseLocalAgentEndpoint(a.endpointUrl || '')));
  const askRevoke = (agent: NeuroAgent) => setConfirm({ title: `Revoke ${agent.name}?`, body: 'It disappears from New chat. Jobs already done stay in your Timeline.', run: () => disconnectModel(agent.id) });

  return (
    <div className="mx-auto max-w-[1000px] space-y-8">
      <header className="flex flex-wrap items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-[#e7e2d9] bg-[#f2eee6] text-[#08666c]"><Plug aria-hidden="true" className="size-7" /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Connections</h1>
          <p className="mt-1.5 text-sm text-[#665f54] sm:text-base">Computers that run Codex and Claude Code for you, and the agents you've connected.</p>
        </div>
        <button type="button" onClick={onNewChat} className="workspace-button">New chat</button>
      </header>

      {notice && (
        <p role="status" className="flex items-start justify-between gap-3 rounded-2xl border border-[#e7e2d9] bg-[#fffdfa] px-4 py-3 text-sm text-[#4b4941]">
          {notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss" className="text-[#8a8478] hover:text-[#282820]"><X aria-hidden="true" className="size-4" /></button>
        </p>
      )}

      <section aria-label="Computers" className="space-y-3">
        <SectionTitle title="Computers" count={devices?.length ?? 0}>
          <button type="button" onClick={() => { devices?.filter(d => d.online).forEach(d => void deviceAction(d.id, 'check').catch(() => {})); void refresh(); }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-[#4b4941] hover:bg-[#ede9e0]">
            <RefreshCw aria-hidden="true" className="size-4" /> Check again
          </button>
          <button type="button" onClick={() => setAdding(true)} className="workspace-primary min-h-9"><Plus aria-hidden="true" className="size-4" /> Add a computer</button>
        </SectionTitle>
        {checkedAt && <p className="text-xs text-[#8a8478]">Checked {ago(new Date(checkedAt).toISOString())}.</p>}
        {desktop && desktopStatus && !desktopStatus.paired && (
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#8bb6ae] bg-[#e9f2eb] p-4 ring-4 ring-[#e7efe7]">
            <Laptop aria-hidden="true" className="size-6 text-[#08666c]" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#282820]">Use this computer for Codex and Claude Code</p>
              <p className="text-sm text-[#4b4941]">The AgentHub app runs jobs here in the background, with your own sign-in. No terminal needed.</p>
            </div>
            <button type="button" onClick={() => void connectThisComputer()} disabled={pairingThis} className="workspace-primary">
              {pairingThis ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Plus aria-hidden="true" className="size-4" />} Connect this computer
            </button>
          </div>
        )}

        {devices === null ? <p className="flex items-center gap-2 text-sm text-[#665f54]"><Loader2 aria-hidden="true" className="size-4 animate-spin" /> Loading…</p> : devices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d8d3ca] p-8 text-center">
            <Laptop aria-hidden="true" className="mx-auto size-8 text-[#a9a397]" />
            <p className="mt-3 font-medium">No computers yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-[#665f54]">Add your computer to run Codex (with ChatGPT) and Claude Code (with your Claude plan) for AgentHub jobs.</p>
            <button type="button" onClick={() => setAdding(true)} className="workspace-primary mt-4"><Plus aria-hidden="true" className="size-4" /> Add a computer</button>
          </div>
        ) : devices.map(device => (
          <article key={device.id} className="workspace-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-[#efebe3] bg-[#faf8f4] px-4 py-3">
              <Laptop aria-hidden="true" className="size-5 text-[#665f54]" />
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-2 truncate font-semibold">{device.name}{desktopStatus?.deviceId === device.id && <span className="rounded-md bg-[#08666c] px-1.5 py-0.5 text-[11px] font-medium text-white">This computer</span>}</h3>
                <p className="text-xs text-[#8a8478]">
                  {device.paired ? [device.platform, device.connectorVersion && `connector ${device.connectorVersion}`, device.report.node && `Node ${device.report.node}`, !device.online && device.lastSeenAt && `last seen ${ago(device.lastSeenAt)}`].filter(Boolean).join(' · ') : 'Setup not finished'}
                </p>
              </div>
              <Pill tone={device.online ? 'ok' : 'muted'}>{device.online ? 'Online' : device.paired ? 'Offline' : 'Waiting'}</Pill>
              <button type="button" onClick={() => setConfirm({ title: `Remove ${device.name}?`, body: 'Its connector stops working and its Codex and Claude Code agents are revoked. You can add it again later.', run: async () => { for (const a of localAgents.filter(x => parseLocalAgentEndpoint(x.endpointUrl || '') === device.id)) await disconnectModel(a.id); await removeDevice(device.id); await refresh(); } })}
                className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#665f54] hover:bg-[#f9ece4] hover:text-[#922d1d]">Remove</button>
            </div>
            {!device.paired ? (
              <p className="px-4 py-4 text-sm text-[#665f54]">This computer never connected. Remove it and use <span className="font-medium">Add a computer</span> to get a fresh setup command.</p>
            ) : (
              <ul className="divide-y divide-[#efebe3]">
                {HARNESSES.map(harness => {
                  const report = device.report.harnesses?.[harness.id];
                  const state = harnessState(device, harness.id, busyKey);
                  const linked = deviceAgents(device.id, harness.provider);
                  const subtitle = report?.installed
                    ? [`v${report.version ?? '?'}`, report.signedIn ? `Signed in with ${harness.account}` : report.signedIn === false ? 'Not signed in' : null, `${linked.length} agent${linked.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')
                    : `Not installed on this computer${report?.latest ? ` · latest v${report.latest}` : ''}`;
                  return (
                    <li key={harness.id}>
                      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${harness.tile}`}><harness.Icon aria-hidden="true" className="size-5" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{harness.name}</p>
                          <p className="truncate text-sm text-[#8a8478]">{subtitle}</p>
                        </div>
                        <Pill tone={state.tone}>{state.label}</Pill>
                        {state.action && (
                          <button type="button" onClick={() => void act(device, state.action!, harness.id)} className={state.action === 'update' ? 'workspace-button min-h-9' : 'workspace-primary min-h-9 px-3.5'}>
                            {{ install: 'Install', update: 'Update', login: 'Sign in' }[state.action]}
                          </button>
                        )}
                        {(state.tone === 'ok' || state.action === 'update') && (
                          <button type="button" onClick={() => void addAgent(device, harness)} className="workspace-primary min-h-9 px-3.5"><Plus aria-hidden="true" className="size-4" /> Add agent</button>
                        )}
                      </div>
                      {linked.length > 0 && (
                        <ul className="divide-y divide-[#f2eee6] border-t border-[#f2eee6] bg-[#fffdfa] pr-4">
                          {linked.map(agent => <AgentRow key={agent.id} agent={agent} label={harness.name} onRevoke={() => askRevoke(agent)} />)}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        ))}
        {orphanAgents.length > 0 && (
          <div className="workspace-card">
            <p className="border-b border-[#efebe3] px-4 py-3 text-sm text-[#665f54]">These agents aren't linked to a computer any more (older setup). Revoke them and add them again from a computer above.</p>
            <ul className="divide-y divide-[#f2eee6] pr-4">{orphanAgents.map(agent => <AgentRow key={agent.id} agent={agent} label={agent.provider === 'Claude Code' ? 'Claude Code' : 'Codex'} onRevoke={() => askRevoke(agent)} />)}</ul>
          </div>
        )}
      </section>

      <section aria-label="API agents" className="space-y-3">
        <SectionTitle title="API agents" count={apiAgents.length}>
          <button type="button" onClick={() => { setEditingModel(null); setIsConnectModalOpen(true); }} className="workspace-button min-h-9"><Plug aria-hidden="true" className="size-4" /> Connect API agent</button>
        </SectionTitle>
        {apiAgents.length === 0 ? <p className="rounded-2xl border border-dashed border-[#d8d3ca] p-5 text-sm text-[#665f54]">Gemini, OpenAI, Anthropic API, Ollama, Hermes and other endpoints appear here.</p> : (
          <ul className="workspace-card divide-y divide-[#efebe3]">
            {apiAgents.map(agent => (
              <li key={agent.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e9f2eb] text-sm font-semibold text-[#1f6b5f]">{(agent.provider || agent.name).slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{agent.name}</p>
                  <p className="truncate text-xs text-[#8a8478]">{agent.provider === 'OpenAI-Compatible' ? 'OpenAI / Compatible' : agent.provider} · {agent.model} · Added {agent.createdAt ? dateFormat.format(Date.parse(agent.createdAt)) : agent.date} · {agent.tokens.toLocaleString()} tokens</p>
                </div>
                <Pill tone={agent.status === 'Active' ? 'ok' : 'muted'}>{agent.status === 'Active' ? 'In use' : 'Connected'}</Pill>
                <button type="button" onClick={() => { setEditingModel(agent); setIsConnectModalOpen(true); }} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#4b4941] hover:bg-[#ede9e0]">Manage</button>
                <button type="button" onClick={() => askRevoke(agent)} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#665f54] hover:bg-[#f9ece4] hover:text-[#922d1d]">Revoke</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {adding && <AddComputerDialog onClose={() => { setAdding(false); void refresh(); }} onConnected={() => void refresh()} />}
      {confirm && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-50 grid place-items-center bg-[#26251e]/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-[#e7e2d9] bg-[#fffdfa] p-6 shadow-2xl">
            <h2 id="confirm-title" className="text-lg font-semibold">{confirm.title}</h2>
            <p className="text-sm text-[#4b4941]">{confirm.body}</p>
            <div className="flex justify-end gap-2">
              <button type="button" autoFocus onClick={() => setConfirm(null)} className="workspace-button">Cancel</button>
              <button type="button" onClick={async () => { const c = confirm; setConfirm(null); try { await c.run(); } catch (err) { setNotice(err instanceof Error ? err.message : 'That did not work.'); } }}
                className="inline-flex min-h-10 items-center rounded-xl bg-[#922d1d] px-4 text-sm font-medium text-white hover:bg-[#7a2516]">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
