import { MAX_AGENT_STEPS, type AgentStep } from '../src/lib/agentSteps.ts';

/** Parses `claude -p --output-format stream-json` output (streamed from the person's computer). */

const MAX_OUTPUT_CHARS = 200_000;
const TOKEN_HINT = 'Sign in to Claude Code on that computer (run `claude` and type /login), then click “Check again” in Connections.';

interface ContentBlock {
  type?: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  is_error?: boolean;
}

interface StreamEvent {
  type?: string;
  subtype?: string;
  message?: { content?: ContentBlock[] | string };
  result?: string;
  is_error?: boolean;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);
const str = (value: unknown) => (typeof value === 'string' ? value : '');

function toolStep(name: string, input: Record<string, unknown>): AgentStep {
  switch (name) {
    case 'WebSearch': return { kind: 'search', query: clip(str(input.query), 300) };
    case 'WebFetch': return { kind: 'fetch', url: clip(str(input.url), 400) };
    case 'Read': return { kind: 'read', path: clip(str(input.file_path).replace(/^.*?\/attachments\//, 'attachments/'), 300) };
    case 'TodoWrite': {
      const todos = Array.isArray(input.todos) ? input.todos as { content?: string; status?: string }[] : [];
      return { kind: 'plan', items: todos.slice(0, 20).map(t => ({ text: clip(str(t.content), 300), completed: t.status === 'completed' })) };
    }
    case 'Glob': return { kind: 'tool', name: 'Listed files', detail: clip(str(input.pattern), 200) };
    case 'Grep': return { kind: 'tool', name: 'Searched files', detail: clip(str(input.pattern), 200) };
    default: return { kind: 'tool', name, detail: '' };
  }
}

/** Builds the step timeline incrementally from `claude -p --output-format stream-json` output. */
export function createClaudeCollector() {
  const steps: AgentStep[] = [];
  const byToolId = new Map<string, number>();
  let buffer = '', result = '', resultIsError = false, tokens = 0, lastTextIndex = -1;

  function handle(line: string) {
    if (!line.startsWith('{')) return;
    let event: StreamEvent;
    try { event = JSON.parse(line); } catch { return; }
    const content = Array.isArray(event.message?.content) ? event.message.content : [];
    if (event.type === 'assistant') {
      for (const block of content) {
        if (steps.length >= MAX_AGENT_STEPS) break;
        if (block.type === 'thinking' && block.thinking?.trim()) steps.push({ kind: 'thinking', text: clip(block.thinking.trim(), 3000) });
        else if (block.type === 'text' && block.text?.trim()) { steps.push({ kind: 'message', text: clip(block.text.trim(), MAX_OUTPUT_CHARS) }); lastTextIndex = steps.length - 1; }
        else if (block.type === 'tool_use' && block.name) {
          steps.push(toolStep(block.name, block.input ?? {}));
          if (block.id) byToolId.set(block.id, steps.length - 1);
        }
      }
    }
    if (event.type === 'user') {
      for (const block of content) {
        if (block.type !== 'tool_result' || !block.is_error || !block.tool_use_id) continue;
        const index = byToolId.get(block.tool_use_id);
        const step = index === undefined ? undefined : steps[index];
        if (step && (step.kind === 'fetch' || step.kind === 'read' || step.kind === 'tool')) steps[index!] = { ...step, failed: true };
      }
    }
    if (event.type === 'result') {
      result = str(event.result);
      resultIsError = Boolean(event.is_error) || (event.subtype !== undefined && event.subtype !== 'success');
      const u = event.usage ?? {};
      tokens = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    }
  }

  return {
    push(chunk: string) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) handle(line.trim());
      return lines.length > 0;
    },
    steps: () => [...steps],
    finish() {
      if (buffer.trim()) handle(buffer.trim());
      buffer = '';
      // The final text is the answer itself, not a step.
      const finalText = result || (lastTextIndex >= 0 ? (steps[lastTextIndex] as { text: string }).text : '');
      const visible = steps.filter((step, i) => !(i === lastTextIndex && step.kind === 'message' && (!result || step.text.trim() === result.trim())));
      return { text: resultIsError ? '' : finalText, error: resultIsError ? result : '', tokens, steps: visible };
    },
  };
}

export function claudeFriendlyError(raw: string): string {
  const text = raw.trim();
  if (/invalid.*(api key|token)|oauth|401|403|unauthori[sz]ed|authentication|expired/i.test(text)) return `Claude Code could not sign in with the saved token. ${TOKEN_HINT}`;
  if (/usage limit|rate limit|429|limit reached/i.test(text)) return `Your Claude plan's usage limit was reached. ${clip(text, 200)}`;
  return clip(text, 400) || 'Claude Code exited without a reply.';
}

