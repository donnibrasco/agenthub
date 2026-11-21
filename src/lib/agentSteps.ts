/** One visible step an agent took before its final answer (shown as a timeline in the chat). */
export type AgentStep =
  | { kind: 'thinking'; text: string }
  | { kind: 'message'; text: string }
  | { kind: 'search'; query: string }
  | { kind: 'command'; command: string; output: string; exitCode: number | null; status: 'running' | 'done' | 'failed' }
  | { kind: 'plan'; items: { text: string; completed: boolean }[] }
  | { kind: 'files'; paths: string[] }
  | { kind: 'fetch'; url: string; failed?: boolean }
  | { kind: 'read'; path: string; failed?: boolean }
  | { kind: 'tool'; name: string; detail: string; failed?: boolean };

export const MAX_AGENT_STEPS = 80;
