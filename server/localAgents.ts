import type { EndpointProbeResult } from '../src/lib/modelConnection.ts';
import { isClaudeCodeProvider, parseLocalAgentEndpoint } from '../src/lib/modelConnection.ts';
import type { AgentStep } from '../src/lib/agentSteps.ts';
import type { AgentAttachment } from './attachments.ts';
import { prepareAttachments } from './attachments.ts';
import { claudeFriendlyError, createClaudeCollector } from './claudeCode.ts';
import { codexFriendlyError, createCodexCollector } from './codexCli.ts';
import type { DeviceHub, Harness } from './devices.ts';
import type { PromptRunResult } from './modelProxy.ts';

/** Runs Codex / Claude Code agents on the person's own computer through the AgentHub connector. */

let hub: DeviceHub | null = null;

export function configureLocalAgents(deviceHub: DeviceHub) {
  hub = deviceHub;
}

const HARNESS_NAME: Record<Harness, string> = { codex: 'Codex', claude: 'Claude Code' };

function resolve(provider: string, endpointUrl: string) {
  const harness: Harness = isClaudeCodeProvider(provider) ? 'claude' : 'codex';
  const deviceId = parseLocalAgentEndpoint(endpointUrl);
  const device = deviceId && hub ? hub.get(deviceId) : undefined;
  return { harness, device };
}

function problem(provider: string, endpointUrl: string): string | null {
  const { harness, device } = resolve(provider, endpointUrl);
  if (!hub) return 'Computers are not available on this server.';
  if (!device) return 'This agent is not linked to a computer. Remove it and add it again from Connections.';
  if (!device.online) return `${device.name} is offline. Start the AgentHub connector on it (Connections → ${device.name}).`;
  const report = device.report.harnesses?.[harness];
  if (!report?.installed) return `${HARNESS_NAME[harness]} is not installed on ${device.name}. Click “Install” next to it in Connections.`;
  if (report.signedIn === false) return `${HARNESS_NAME[harness]} is not signed in on ${device.name}. Click “Sign in” next to it in Connections.`;
  return null;
}

export async function probeLocalAgent(provider: string, endpointUrl: string): Promise<EndpointProbeResult> {
  const issue = problem(provider, endpointUrl);
  const { harness, device } = resolve(provider, endpointUrl);
  const version = device?.report.harnesses?.[harness]?.version;
  return {
    reachable: !issue,
    latencyMs: 1,
    message: issue ?? `${HARNESS_NAME[harness]}${version ? ` ${version}` : ''} is ready on ${device!.name}.`,
    modelIds: issue ? undefined : harness === 'claude' ? ['default', 'sonnet', 'opus', 'haiku'] : ['default'],
  };
}

/** Names files uniquely for the run folder and describes them in the prompt. */
function filesForRun(attachments: AgentAttachment[], harness: Harness) {
  const used = new Set<string>();
  const files: { id: string; name: string; kind: string }[] = [];
  const notes: string[] = [];
  const textOnly: AgentAttachment[] = [];
  for (const a of attachments) {
    const sendable = a.kind === 'image' || (harness === 'claude' && (a.kind === 'text' || a.mime === 'application/pdf'));
    if (!sendable) { textOnly.push(a); continue; }
    let name = a.name;
    for (let i = 2; used.has(name.toLowerCase()); i++) name = a.name.replace(/(\.[^.]*)?$/, ` (${i})$1`);
    used.add(name.toLowerCase());
    files.push({ id: a.id, name, kind: a.kind });
    notes.push(harness === 'claude' ? `- "attachments/${name}"` : `- Image "${name}" (attached).`);
  }
  // Codex gets text files inline; videos and other files are described for both.
  const inline = prepareAttachments(textOnly, { inlineImages: false }).promptAppendix.replace(/^\n\nAttachments from the user:\n/, '');
  const intro = harness === 'claude'
    ? 'Attachments from the user (in your working folder; open them with the Read tool):'
    : 'Attachments from the user:';
  const all = [...notes, ...(inline ? [inline] : [])];
  return { files, appendix: all.length ? `\n\n${intro}\n${all.join('\n')}` : '' };
}

export async function runLocalAgent(opts: {
  provider: string;
  endpointUrl: string;
  modelId: string;
  promptText: string;
  attachments?: AgentAttachment[];
  signal?: AbortSignal;
  onSteps?: (steps: AgentStep[]) => void;
}): Promise<PromptRunResult> {
  const start = Date.now();
  const failed = (error: string): PromptRunResult => ({ ok: false, liveUpstream: false, output: '', tokensUsed: 0, latencyMs: Math.max(1, Date.now() - start), error });
  const issue = problem(opts.provider, opts.endpointUrl);
  if (issue) return failed(issue);
  const { harness, device } = resolve(opts.provider, opts.endpointUrl);

  const { files, appendix } = filesForRun(opts.attachments ?? [], harness);
  const collector = harness === 'claude' ? createClaudeCollector() : createCodexCollector();
  const { done } = hub!.send(device!.id, 'run', {
    harness,
    model: opts.modelId.trim() || 'default',
    prompt: opts.promptText + appendix,
    files,
  }, {
    signal: opts.signal,
    onOutput: chunk => { if (collector.push(chunk)) opts.onSteps?.(collector.steps()); },
  });
  const result = await done;
  opts.signal?.throwIfAborted();
  const parsed = collector.finish();
  if (!parsed.text.trim()) {
    const raw = parsed.error || result.error || result.stderr || '';
    return failed(harness === 'claude' ? claudeFriendlyError(raw) : codexFriendlyError(raw));
  }
  return { ok: true, liveUpstream: true, output: parsed.text, steps: parsed.steps, tokensUsed: parsed.tokens, latencyMs: Math.max(1, Date.now() - start) };
}
