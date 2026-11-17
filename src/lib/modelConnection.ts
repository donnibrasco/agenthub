export type ModelRuntime =
  | 'Local Workstation'
  | 'Self-Hosted vLLM'
  | 'Cloud API'
  | 'Kubernetes Cluster';

export type ModelProvider =
  | 'Ollama'
  | 'vLLM'
  | 'Gemini'
  | 'Anthropic'
  | 'DeepSeek'
  | 'OpenAI-Compatible';

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

/**
 * Extracts clean hostname:port for Reddit-style domain tags.
 */
export function normalizeEndpointDomain(url: string): string {
  const trimmed = url.trim();
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

  if (!payload.name || payload.name.trim().length < 2) {
    errors.name = 'Connected model name is required (min 2 characters).';
  }

  if (!payload.modelId || payload.modelId.trim().length < 2) {
    errors.modelId = 'Model identifier is required (e.g., qwen2.5-coder:32b or gemini-2.5-flash).';
  }

  const trimmedUrl = (payload.endpointUrl || '').trim();
  if (!trimmedUrl) {
    errors.endpointUrl = 'Endpoint URL is required (e.g., http://localhost:11434/v1).';
  } else {
    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        errors.endpointUrl = 'Endpoint URL must start with http:// or https://.';
      }
    } catch {
      errors.endpointUrl = 'Enter a valid http:// or https:// endpoint URL.';
    }
  }

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
