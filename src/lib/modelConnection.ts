export type ModelRuntime =
  | 'Local Workstation'
  | 'Self-Hosted vLLM'
  | 'Self-Hosted Server'
  | 'Cloud API'
  | 'Kubernetes Cluster';

export const MODEL_PROVIDERS = [
  'Codex CLI', 'Claude Code', 'Hermes', 'OpenClaw', 'Ollama', 'vLLM', 'Gemini', 'Anthropic', 'DeepSeek', 'OpenAI-Compatible',
] as const;

/** Codex and Claude Code run on the person's own computer (through the AgentHub connector), not behind a URL. */
export const CODEX_CLI_PROVIDER = 'Codex CLI';

export function isCodexCliProvider(provider: string | undefined): boolean {
  return provider === CODEX_CLI_PROVIDER;
}

export const CLAUDE_CODE_PROVIDER = 'Claude Code';

export function isClaudeCodeProvider(provider: string | undefined): boolean {
  return provider === CLAUDE_CODE_PROVIDER;
}

/** Agents that run on a connected computer rather than behind a URL. */
export function isLocalAgentProvider(provider: string | undefined): boolean {
  return isCodexCliProvider(provider) || isClaudeCodeProvider(provider);
}

/** e.g. `codex://dev_…` — which computer runs this agent. */
export function localAgentEndpoint(provider: string, deviceId: string): string {
  return `${isClaudeCodeProvider(provider) ? 'claude-code' : 'codex'}://${deviceId}`;
}

export function parseLocalAgentEndpoint(endpointUrl: string): string | null {
  return endpointUrl.trim().match(/^(?:codex|claude-code):\/\/(dev_[0-9a-f-]{36})$/)?.[1] ?? null;
}

export type ModelProvider = typeof MODEL_PROVIDERS[number];

export function isAgentGatewayProvider(provider: string): boolean {
  return provider === 'Hermes' || provider === 'OpenClaw';
}

export interface ModelConnectionPayload {
  name: string;
  modelId: string;
  endpointUrl: string;
  runtime: ModelRuntime;
  provider: ModelProvider;
  category: string;
  description?: string;
  authToken?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  domain: string;
}

export interface EndpointProbeResult {
  reachable: boolean;
  httpStatus?: number;
  latencyMs: number;
  message: string;
  modelIds?: string[];
}

export function validateModelEndpoint(endpointUrl: string, provider?: string): string | undefined {
  if (isLocalAgentProvider(provider)) {
    const deviceId = parseLocalAgentEndpoint(endpointUrl);
    return deviceId && endpointUrl.trim() === localAgentEndpoint(provider!, deviceId) ? undefined : 'Choose the computer that runs this agent.';
  }
  if (!endpointUrl.trim()) return 'Enter the base URL for your model API.';
  try {
    const parsed = new URL(endpointUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'Endpoint URL must start with http:// or https://.';
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      return 'Use a base URL and enter credentials in the API key field.';
    }
  } catch {
    return 'Enter a valid http:// or https:// endpoint URL.';
  }
}

/**
 * Extracts clean hostname:port for Reddit-style domain tags.
 */
export function normalizeEndpointDomain(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith('codex://')) return 'codex';
  if (trimmed.startsWith('claude-code://')) return 'claude-code';
  if (!trimmed) return 'localhost';
  try {
    const parsed = new URL(trimmed);
    return parsed.host || trimmed;
  } catch {
    return trimmed.replace(/^https?:\/\//i, '').split('/')[0] || 'custom.endpoint';
  }
}

/**
 * Validates fields required to connect an already-created model endpoint.
 */
export function validateModelConnection(payload: ModelConnectionPayload): ValidationResult {
  const errors: Record<string, string> = {};

  if (!payload.name.trim()) {
    errors.name = 'Enter a display name for the model.';
  }

  if (!payload.modelId.trim()) {
    errors.modelId = 'Enter the model ID used by your provider.';
  }

  const trimmedUrl = payload.endpointUrl.trim();
  const endpointError = validateModelEndpoint(trimmedUrl, payload.provider);
  if (endpointError) errors.endpointUrl = endpointError;

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    domain: normalizeEndpointDomain(trimmedUrl),
  };
}

/**
 * Generates deterministic E2EE key fingerprint preview from endpoint + model name.
 */
export function generateConnectionFingerprint(seed: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `e2ee:${hex.slice(0, 4)}...${hex.slice(4, 8)}`;
}
