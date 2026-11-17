import crypto from 'node:crypto';

export interface ProbeRequestSpec {
  url: string;
  headers: Record<string, string>;
}

export interface ChatRequestSpec {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export interface ProbeResult {
  reachable: boolean;
  httpStatus?: number;
  latencyMs: number;
  message: string;
}

export interface PromptRunResult {
  ok: boolean;
  liveUpstream: boolean;
  output: string;
  tokensUsed: number;
  latencyMs: number;
  error?: string;
}

function deriveAesKey(secretSeed: string): Buffer {
  return crypto.createHash('sha256').update(secretSeed || 'neuronest-local-workspace-key').digest();
}

export function encryptSecretToken(plain: string, secretSeed: string): string {
  const trimmed = plain.trim();
  if (!trimmed) return '';
  const iv = crypto.randomBytes(12);
  const key = deriveAesKey(secretSeed);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecretToken(encoded: string, secretSeed: string): string {
  if (!encoded) return '';
  const parts = encoded.split(':');
  if (parts.length !== 3) return '';
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const ciphertext = Buffer.from(parts[2], 'hex');
    const key = deriveAesKey(secretSeed);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function buildProbeRequest(
  endpointUrl: string,
  provider: string,
  authToken?: string
): ProbeRequestSpec {
  const cleanBase = endpointUrl.trim().replace(/\/+$/, '');
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (provider === 'Gemini') {
    const modelsUrl = cleanBase.endsWith('/models') ? cleanBase : `${cleanBase}/models`;
    const url = authToken ? `${modelsUrl}?key=${encodeURIComponent(authToken)}` : modelsUrl;
    return { url, headers };
  }

  if (provider === 'Anthropic') {
    if (authToken) headers['x-api-key'] = authToken;
    headers['anthropic-version'] = '2023-06-01';
    const url = cleanBase.endsWith('/models') ? cleanBase : `${cleanBase}/models`;
    return { url, headers };
  }

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  if (provider === 'Ollama' && !cleanBase.endsWith('/v1')) {
    return { url: `${cleanBase}/api/tags`, headers };
  }

  const url = cleanBase.endsWith('/models') ? cleanBase : `${cleanBase}/models`;
  return { url, headers };
}

export function buildChatCompletionRequest(
  endpointUrl: string,
  provider: string,
  modelId: string,
  promptText: string,
  authToken?: string
): ChatRequestSpec {
  const cleanBase = endpointUrl.trim().replace(/\/+$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (provider === 'Gemini') {
    const normalizedModel = modelId.startsWith('models/') ? modelId : `models/${modelId}`;
    const base = cleanBase.replace(/\/models.*$/, '');
    const keyQuery = authToken ? `?key=${encodeURIComponent(authToken)}` : '';
    return {
      url: `${base}/${normalizedModel}:generateContent${keyQuery}`,
      headers,
      body: {
        contents: [{ parts: [{ text: promptText }] }],
      },
    };
  }

  if (provider === 'Anthropic') {
    if (authToken) headers['x-api-key'] = authToken;
    headers['anthropic-version'] = '2023-06-01';
    return {
      url: `${cleanBase}/messages`,
      headers,
      body: {
        model: modelId,
        max_tokens: 1024,
        messages: [{ role: 'user', content: promptText }],
      },
    };
  }

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  if (provider === 'Ollama' && !cleanBase.endsWith('/v1')) {
    return {
      url: `${cleanBase}/api/chat`,
      headers,
      body: {
        model: modelId,
        stream: false,
        messages: [{ role: 'user', content: promptText }],
      },
    };
  }

  return {
    url: `${cleanBase}/chat/completions`,
    headers,
    body: {
      model: modelId,
      messages: [{ role: 'user', content: promptText }],
      temperature: 0.3,
    },
  };
}

export function extractModelReplyText(
  provider: string,
  payload: unknown
): { text: string; tokensUsed: number } {
  const data = payload as Record<string, unknown> | null;
  if (!data || typeof data !== 'object') {
    return { text: '', tokensUsed: 0 };
  }

  if (provider === 'Gemini') {
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    const first = candidates[0] as Record<string, unknown> | undefined;
    const content = first?.content as Record<string, unknown> | undefined;
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    const text = parts
      .map(p => (p as Record<string, unknown>)?.text)
      .filter((t): t is string => typeof t === 'string')
      .join('\n');
    const usage = data.usageMetadata as Record<string, unknown> | undefined;
    const tokensUsed = Number(usage?.totalTokenCount || 0) || Math.max(24, Math.ceil(text.length / 4));
    return { text, tokensUsed };
  }

  if (provider === 'Anthropic') {
    const blocks = Array.isArray(data.content) ? data.content : [];
    const text = blocks
      .map(b => (b as Record<string, unknown>)?.text)
      .filter((t): t is string => typeof t === 'string')
      .join('\n');
    const usage = data.usage as Record<string, unknown> | undefined;
    const tokensUsed =
      Number(usage?.input_tokens || 0) + Number(usage?.output_tokens || 0) ||
      Math.max(24, Math.ceil(text.length / 4));
    return { text, tokensUsed };
  }

  // Ollama native /api/chat
  if (data.message && typeof data.message === 'object') {
    const msg = data.message as Record<string, unknown>;
    const text = typeof msg.content === 'string' ? msg.content : '';
    const tokensUsed =
      Number(data.prompt_eval_count || 0) + Number(data.eval_count || 0) ||
      Math.max(24, Math.ceil(text.length / 4));
    return { text, tokensUsed };
  }

  // OpenAI-compatible (/v1/chat/completions — vLLM, Ollama /v1, DeepSeek, etc.)
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const choiceMsg = firstChoice?.message as Record<string, unknown> | undefined;
  const text = typeof choiceMsg?.content === 'string' ? choiceMsg.content : '';
  const usage = data.usage as Record<string, unknown> | undefined;
  const tokensUsed = Number(usage?.total_tokens || 0) || Math.max(24, Math.ceil(text.length / 4));
  return { text, tokensUsed };
}

export async function probeModelEndpoint(
  endpointUrl: string,
  provider: string,
  authToken?: string
): Promise<ProbeResult> {
  const spec = buildProbeRequest(endpointUrl, provider, authToken);
  const start = Date.now();
  try {
    const res = await fetch(spec.url, {
      method: 'GET',
      headers: spec.headers,
      signal: AbortSignal.timeout(4500),
    });
    const latencyMs = Math.max(1, Date.now() - start);
    if (res.ok) {
      return {
        reachable: true,
        httpStatus: res.status,
        latencyMs,
        message: `${res.status} OK from ${new URL(spec.url).host}`,
      };
    }
    // A 401/403 proves the host is reachable on the network even if auth key is missing
    const reachable = res.status === 401 || res.status === 403 || res.status === 404;
    return {
      reachable,
      httpStatus: res.status,
      latencyMs,
      message: `HTTP ${res.status} (${res.statusText || 'Response received'})`,
    };
  } catch (err) {
    const latencyMs = Math.max(1, Date.now() - start);
    const reason = err instanceof Error ? err.message : 'Connection failed';
    return {
      reachable: false,
      latencyMs,
      message: `Unreachable (${reason})`,
    };
  }
}

export async function runPromptAgainstModel(opts: {
  endpointUrl: string;
  provider: string;
  modelId: string;
  promptText: string;
  authToken?: string;
}): Promise<PromptRunResult> {
  const spec = buildChatCompletionRequest(
    opts.endpointUrl,
    opts.provider,
    opts.modelId,
    opts.promptText,
    opts.authToken
  );

  const start = Date.now();
  try {
    const res = await fetch(spec.url, {
      method: 'POST',
      headers: spec.headers,
      body: JSON.stringify(spec.body),
      signal: AbortSignal.timeout(15000),
    });
    const latencyMs = Math.max(1, Date.now() - start);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      return {
        ok: false,
        liveUpstream: false,
        output: '',
        tokensUsed: 0,
        latencyMs,
        error: `Upstream ${res.status}: ${errBody.slice(0, 240) || res.statusText}`,
      };
    }

    const json = await res.json();
    const extracted = extractModelReplyText(opts.provider, json);
    return {
      ok: true,
      liveUpstream: true,
      output: extracted.text || '(Model returned empty response)',
      tokensUsed: extracted.tokensUsed,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Math.max(1, Date.now() - start);
    const reason = err instanceof Error ? err.message : 'Network error';
    return {
      ok: false,
      liveUpstream: false,
      output: '',
      tokensUsed: 0,
      latencyMs,
      error: `Could not reach ${opts.endpointUrl}: ${reason}`,
    };
  }
}
