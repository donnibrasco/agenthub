import { MAX_AGENT_STEPS, type AgentStep } from '../src/lib/agentSteps.ts';

/** Parses `codex exec --json` output (streamed from the person's computer) into steps and an answer. */

const LOGIN_HINT = 'Codex is not signed in on that computer. Open Connections and click “Sign in” next to Codex.';

interface CodexItem {
  id?: string;
  type?: string;
  text?: string;
  command?: string;
  aggregated_output?: string;
  exit_code?: number | null;
  status?: string;
  query?: string;
  action?: { query?: string; queries?: string[] };
  items?: { text?: string; completed?: boolean }[];
  changes?: { path?: string }[];
}

interface CodexEvent {
  type?: string;
  message?: string;
  item?: CodexItem;
  usage?: { input_tokens?: number; output_tokens?: number; reasoning_output_tokens?: number };
  error?: { message?: string };
}

const MAX_OUTPUT_CHARS = 200_000;
const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);
const clipTail = (text: string, max: number) => (text.length > max ? `…${text.slice(-max)}` : text);

/** Codex wraps commands as `/bin/bash -lc '…'`; show just the command. */
function displayCommand(command: string) {
  const match = command.match(/^\S*(?:ba|z)?sh -l?c '([\s\S]*)'$/);
  return clip((match ? match[1].replace(/'\\''/g, "'") : command).trim(), 600);
}

function toStep(item: CodexItem): AgentStep | null {
  switch (item.type) {
    case 'reasoning': return item.text?.trim() ? { kind: 'thinking', text: clip(item.text.trim(), 3000) } : null;
    case 'agent_message': return item.text?.trim() ? { kind: 'message', text: clip(item.text.trim(), MAX_OUTPUT_CHARS) } : null;
    case 'web_search': {
      const query = item.query?.trim() || item.action?.query?.trim() || item.action?.queries?.find(q => q.trim()) || '';
      return { kind: 'search', query: clip(query, 300) };
    }
    case 'command_execution': {
      const status = item.status === 'in_progress' ? 'running' : item.exit_code === 0 ? 'done' : 'failed';
      return { kind: 'command', command: displayCommand(item.command || ''), output: clipTail((item.aggregated_output || '').trimEnd(), 4000), exitCode: item.exit_code ?? null, status };
    }
    case 'todo_list': return item.items?.length ? { kind: 'plan', items: item.items.slice(0, 20).map(i => ({ text: clip(i.text || '', 300), completed: Boolean(i.completed) })) } : null;
    case 'file_change': return item.changes?.length ? { kind: 'files', paths: item.changes.slice(0, 20).map(c => c.path || '').filter(Boolean) } : null;
    default: return null;
  }
}

/** Builds the step timeline incrementally from `codex exec --json` output. */
export function createCodexCollector() {
  const order: string[] = [];
  const steps = new Map<string, AgentStep>();
  let buffer = '', finalText = '', finalId = '', tokens = 0, error = '', anon = 0;

  function handle(line: string) {
    if (!line.startsWith('{')) return;
    let event: CodexEvent;
    try { event = JSON.parse(line); } catch { return; }
    if ((event.type === 'item.started' || event.type === 'item.updated' || event.type === 'item.completed') && event.item) {
      const id = event.item.id || `anon-${anon++}`;
      // Web searches arrive empty when they start; wait for the query.
      if (event.item.type === 'web_search' && event.type !== 'item.completed') return;
      const step = toStep(event.item);
      if (!step) return;
      if (!steps.has(id)) {
        if (order.length >= MAX_AGENT_STEPS) return;
        order.push(id);
      }
      steps.set(id, step);
      if (step.kind === 'message' && event.type === 'item.completed') { finalText = step.text; finalId = id; }
    }
    if (event.type === 'turn.completed' && event.usage) {
      tokens += (event.usage.input_tokens || 0) + (event.usage.output_tokens || 0) + (event.usage.reasoning_output_tokens || 0);
    }
    if (event.type === 'error' && event.message) error = event.message;
    if (event.type === 'turn.failed' && event.error?.message) error = event.error.message;
  }

  return {
    /** Feed raw stdout; returns true when the visible steps changed. */
    push(chunk: string) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      const before = order.length;
      for (const line of lines) handle(line.trim());
      return lines.length > 0 || order.length !== before;
    },
    /** Steps so far (live view). */
    steps: () => order.map(id => steps.get(id)!),
    finish() {
      if (buffer.trim()) handle(buffer.trim());
      buffer = '';
      // The last message is the answer itself, not a step.
      const visible = order.filter(id => id !== finalId).map(id => steps.get(id)!);
      return { text: finalText, tokens, error, steps: visible };
    },
  };
}

export function parseCodexJsonl(stdout: string) {
  const collector = createCodexCollector();
  collector.push(stdout.endsWith('\n') ? stdout : `${stdout}\n`);
  return collector.finish();
}

export function codexFriendlyError(raw: string): string {
  const text = stripAnsi(raw).trim();
  if (/not logged in|login|unauthori[sz]ed|401|refresh token/i.test(text)) return LOGIN_HINT;
  if (/usage limit|rate limit|429/i.test(text)) return `Your ChatGPT plan's Codex usage limit was reached. ${text.slice(0, 200)}`;
  return text.slice(0, 400) || 'Codex exited without a reply.';
}

