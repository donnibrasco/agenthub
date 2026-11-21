export const CODEX_MESSAGE_LIMIT = 4000;
export const CODEX_HISTORY_LIMIT = 12;

export interface CodexSettings {
  configured: boolean;
  source: 'workspace' | 'server' | null;
}

export type CodexAction = {
  kind: 'model' | 'disconnect' | 'job';
  id: string;
  summary: string;
};

export interface CodexTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CodexReply {
  message: string;
  actions: CodexAction[];
  workspaceChanged: boolean;
}

export type CodexEvent =
  | { type: 'status'; label: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; reply: CodexReply }
  | { type: 'error'; message: string; openSettings?: boolean };

export async function* readEventData(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let data: string[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() + '\n\n' : decoder.decode(value, { stream: true });
      if (buffer.length > 1_048_576) throw new Error('Chat stream event was too large.');
      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);
        if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
        if (line === '' && data.length) {
          yield data.join('\n');
          data = [];
        }
      }
      if (done) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
