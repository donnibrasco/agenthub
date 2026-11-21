import { decryptSecretToken, encryptSecretToken } from './secrets.ts';

export { decryptSecretToken, encryptSecretToken };
import { isAgentGatewayProvider, isLocalAgentProvider, type EndpointProbeResult } from '../src/lib/modelConnection.ts';
import { probeLocalAgent, runLocalAgent } from './localAgents.ts';
import type { AgentStep } from '../src/lib/agentSteps.ts';
import { prepareAttachments, type AgentAttachment } from './attachments.ts';

export interface ProbeRequestSpec {
  url: string;
  headers: Record<string, string>;
}

export interface ChatRequestSpec {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export interface PromptRunResult {
  ok: boolean;
  liveUpstream: boolean;
  output: string;
  tokensUsed: number;
  latencyMs: number;
  error?: string;
  /** Visible work before the answer (Codex only). */
  steps?: AgentStep[];
}

function modelApiBase(endpointUrl: string, provider: string): string {
  const base = endpointUrl.trim().replace(/\/+$/, '');
  return isAgentGatewayProvider(provider) && !base.endsWith('/v1') ? `${base}/v1` : base;
}

export function buildProbeRequest(
  endpointUrl: string,
  provider: string,
  authToken?: string
): ProbeRequestSpec {
  const cleanBase = modelApiBase(endpointUrl, provider);
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
  authToken?: string,
  images: { mime: string; data: string }[] = [],
): ChatRequestSpec {
  const cleanBase = modelApiBase(endpointUrl, provider);
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
        contents: [{ parts: [{ text: promptText }, ...images.map(img => ({ inline_data: { mime_type: img.mime, data: img.data } }))] }],
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
        messages: [{
          role: 'user',
          content: images.length
            ? [...images.map(img => ({ type: 'image', source: { type: 'base64', media_type: img.mime, data: img.data } })), { type: 'text', text: promptText }]
            : promptText,
        }],
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
        messages: [{ role: 'user', content: promptText, ...(images.length ? { images: images.map(img => img.data) } : {}) }],
      },
    };
  }

  return {
    url: `${cleanBase}/chat/completions`,
    headers,
    body: {
      model: modelId,
      messages: [{
        role: 'user',
        content: images.length
          ? [{ type: 'text', text: promptText }, ...images.map(img => ({ type: 'image_url', image_url: { url: `data:${img.mime};base64,${img.data}` } }))]
          : promptText,
      }],
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
    const tokensUsed = Number(usage?.totalTokenCount || 0);
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
      Number(usage?.input_tokens || 0) + Number(usage?.output_tokens || 0);
    return { text, tokensUsed };
  }

  // Ollama native /api/chat
  if (data.message && typeof data.message === 'object') {
    const msg = data.message as Record<string, unknown>;
    const text = typeof msg.content === 'string' ? msg.content : '';
    const tokensUsed =
      Number(data.prompt_eval_count || 0) + Number(data.eval_count || 0);
    return { text, tokensUsed };
  }

  // OpenAI-compatible (/v1/chat/completions — vLLM, Ollama /v1, DeepSeek, etc.)
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const choiceMsg = firstChoice?.message as Record<string, unknown> | undefined;
  const text = typeof choiceMsg?.content === 'string' ? choiceMsg.content : '';
  const usage = data.usage as Record<string, unknown> | undefined;
  const tokensUsed = Number(usage?.total_tokens || 0);
  return { text, tokensUsed };
}

function extractModelIds(payload: unknown): string[] | undefined {
  const result = payload as { data?: unknown; models?: unknown } | null;
  const entries = [result?.data, result?.models].find(Array.isArray);
  if (!Array.isArray(entries)) return undefined;

  const ids = entries.flatMap((entry: { id?: unknown; model?: unknown; name?: unknown } | null) => {
    const id = entry?.id ?? entry?.model ?? entry?.name;
    return typeof id === 'string' && id.trim() ? [id] : [];
  });
  return [...new Set(ids)].sort();
}

export async function probeModelEndpoint(
  endpointUrl: string,
  provider: string,
  authToken?: string,
  signal?: AbortSignal,
): Promise<EndpointProbeResult> {
  if (isLocalAgentProvider(provider)) return probeLocalAgent(provider, endpointUrl);
  const spec = buildProbeRequest(endpointUrl, provider, authToken);
  const start = Date.now();
  try {
    const res = await fetch(spec.url, {
      method: 'GET',
      headers: spec.headers,
      redirect: authToken || isAgentGatewayProvider(provider) ? 'manual' : 'follow',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(4500)]) : AbortSignal.timeout(4500),
    });
    if (res.ok) {
      const modelIds = extractModelIds(await res.json().catch(() => null))
        ?.filter(id => !authToken || !id.includes(authToken));
      return {
        reachable: modelIds !== undefined,
        httpStatus: res.status,
        latencyMs: Math.max(1, Date.now() - start),
        message: modelIds === undefined
          ? 'The endpoint did not return a model list. Check the provider and base URL.'
          : modelIds.length ? `Found ${modelIds.length} model${modelIds.length === 1 ? '' : 's'}.` : 'The provider returned an empty model list.',
        modelIds,
      };
    }
    await res.body?.cancel();
    const guidance = res.status >= 300 && res.status < 400
      ? 'Use the final API base URL and check for an interactive sign-in redirect.'
      : res.status === 401 || res.status === 403
        ? 'Check the API key and its permissions.'
        : 'Check the base URL and provider.';
    return {
      reachable: false,
      httpStatus: res.status,
      latencyMs: Math.max(1, Date.now() - start),
      message: `HTTP ${res.status}. ${guidance}`,
    };
  } catch (err) {
    signal?.throwIfAborted();
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
  signal?: AbortSignal;
  onSteps?: (steps: AgentStep[]) => void;
  attachments?: AgentAttachment[];
}): Promise<PromptRunResult> {
  if (isLocalAgentProvider(opts.provider)) {
    return runLocalAgent({ provider: opts.provider, endpointUrl: opts.endpointUrl, modelId: opts.modelId, promptText: opts.promptText, attachments: opts.attachments, signal: opts.signal, onSteps: opts.onSteps });
  }
  const prepared = opts.attachments?.length ? prepareAttachments(opts.attachments, { inlineImages: true }) : null;
  const promptText = opts.promptText + (prepared?.promptAppendix ?? '');
  const spec = buildChatCompletionRequest(
    opts.endpointUrl,
    opts.provider,
    opts.modelId,
    promptText,
    opts.authToken,
    prepared?.images.flatMap(img => (img.data ? [{ mime: img.mime, data: img.data }] : [])) ?? [],
  );

  const start = Date.now();
  try {
    const timeout = AbortSignal.timeout(120_000);
    const res = await fetch(spec.url, {
      method: 'POST',
      headers: spec.headers,
      body: JSON.stringify(spec.body),
      redirect: opts.authToken || isAgentGatewayProvider(opts.provider) ? 'error' : 'follow',
      signal: opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout,
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      const errBody = opts.authToken ? bodyText.replaceAll(opts.authToken, '[redacted]') : bodyText;
      return {
        ok: false,
        liveUpstream: false,
        output: '',
        tokensUsed: 0,
        latencyMs: Math.max(1, Date.now() - start),
        error: `Upstream ${res.status}: ${errBody.slice(0, 240) || res.statusText}`,
      };
    }

    const json = await res.json();
    const { text, tokensUsed } = extractModelReplyText(opts.provider, json);
    return {
      ok: Boolean(text.trim()),
      liveUpstream: Boolean(text.trim()),
      output: opts.authToken ? text.replaceAll(opts.authToken, '[redacted]') : text,
      tokensUsed: Number.isFinite(tokensUsed) && tokensUsed > 0 ? tokensUsed : 0,
      latencyMs: Math.max(1, Date.now() - start),
      error: text.trim() ? undefined : 'The provider returned no text. Check that this model supports text generation.',
    };
  } catch (err) {
    opts.signal?.throwIfAborted();
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
