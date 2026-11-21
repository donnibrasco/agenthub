import React, { useState, useEffect, useRef } from 'react';
import { useEscapeKey } from '../lib/useEscapeKey';
import { useNeuro } from '../context/NeuroContext';
import {
  ModelRuntime,
  ModelProvider,
  MODEL_PROVIDERS,
  isAgentGatewayProvider,
  isCodexCliProvider,
  isClaudeCodeProvider,
  isLocalAgentProvider,
  validateModelConnection,
  validateModelEndpoint,
  type EndpointProbeResult,
} from '../lib/modelConnection';
import {
  Plug,
  X,
  CheckCircle2,
  Activity,
  Trash2,
  KeyRound,
  AlertCircle,
  Loader2,
} from 'lucide-react';

const PROVIDER_DEFAULTS: Record<ModelProvider, { runtime: ModelRuntime; baseUrl: string; modelId?: string }> = {
  'Codex CLI': { runtime: 'Local Workstation', baseUrl: '', modelId: 'default' },
  'Claude Code': { runtime: 'Local Workstation', baseUrl: '', modelId: 'default' },
  Hermes: { runtime: 'Self-Hosted Server', baseUrl: 'http://127.0.0.1:8642/v1', modelId: 'hermes-agent' },
  OpenClaw: { runtime: 'Self-Hosted Server', baseUrl: 'http://127.0.0.1:18789/v1', modelId: 'openclaw/default' },
  Ollama: { runtime: 'Local Workstation', baseUrl: 'http://localhost:11434' },
  vLLM: { runtime: 'Self-Hosted vLLM', baseUrl: 'http://localhost:8000/v1' },
  Gemini: { runtime: 'Cloud API', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  Anthropic: { runtime: 'Cloud API', baseUrl: 'https://api.anthropic.com/v1' },
  DeepSeek: { runtime: 'Cloud API', baseUrl: 'https://api.deepseek.com/v1' },
  'OpenAI-Compatible': { runtime: 'Cloud API', baseUrl: 'https://api.openai.com/v1' },
};

export function ConnectModelModal() {
  const {
    isConnectModalOpen,
    setIsConnectModalOpen,
    editingModel,
    setEditingModel,
    probeEndpoint,
    connectModel,
    updateModelConnection,
    disconnectModel,
  } = useNeuro();

  const [name, setName] = useState('');
  const [provider, setProvider] = useState<ModelProvider>('Ollama');
  const [runtime, setRuntime] = useState<ModelRuntime>('Local Workstation');
  const [modelId, setModelId] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [category, setCategory] = useState('Engineering');
  const [description, setDescription] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pingResult, setPingResult] = useState<EndpointProbeResult | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const probeVersion = useRef(0);
  const isCodexCli = isCodexCliProvider(provider);
  const isClaude = isClaudeCodeProvider(provider);
  const isLocal = isLocalAgentProvider(provider);

  const clearProbe = () => {
    probeVersion.current++;
    setPingResult(null);
    setIsPinging(false);
  };

  useEffect(() => {
    if (!isConnectModalOpen) return;
    setErrors({});
    clearProbe();
    setAuthToken('');

    if (editingModel) {
      setName(editingModel.name);
      setProvider(editingModel.provider || 'OpenAI-Compatible');
      setRuntime(editingModel.runtime || PROVIDER_DEFAULTS[editingModel.provider || 'OpenAI-Compatible']?.runtime || 'Self-Hosted Server');
      setModelId(editingModel.model);
      setEndpointUrl(editingModel.endpointUrl || '');
      setCategory(editingModel.category || 'Engineering');
      setDescription(editingModel.description || '');
    } else {
      setName('');
      setProvider('Ollama');
      setRuntime(PROVIDER_DEFAULTS.Ollama.runtime);
      setModelId('');
      setEndpointUrl('');
      setCategory('Engineering');
      setDescription('');
    }
  }, [isConnectModalOpen, editingModel]);

  useEscapeKey(isConnectModalOpen, () => {
    clearProbe();
    setIsConnectModalOpen(false);
    setEditingModel(null);
  });
  if (!isConnectModalOpen) return null;

  const handleClose = () => {
    clearProbe();
    setIsConnectModalOpen(false);
    setEditingModel(null);
  };

  const handleSelectProvider = (nextProvider: ModelProvider) => {
    if (nextProvider === provider) return;
    clearProbe();
    setProvider(nextProvider);
    setAuthToken('');
    const preset = PROVIDER_DEFAULTS[nextProvider];
    if (isLocalAgentProvider(nextProvider)) return;
    if (!editingModel) {
      setRuntime(preset.runtime);
      if (!endpointUrl || endpointUrl === PROVIDER_DEFAULTS[provider].baseUrl) {
        setEndpointUrl(preset.runtime === 'Cloud API' ? preset.baseUrl : '');
      }
      if (!modelId || modelId === PROVIDER_DEFAULTS[provider].modelId) setModelId(preset.modelId ?? '');
    }
  };

  const handleTestPing = async () => {
    const endpointError = validateModelEndpoint(endpointUrl.trim(), provider);
    if (endpointError) {
      setErrors({ endpointUrl: endpointError });
      return;
    }

    setErrors({});
    setIsPinging(true);
    setPingResult(null);
    const version = ++probeVersion.current;
    try {
      const probe = await probeEndpoint({
        endpointUrl,
        provider,
        authToken: authToken || undefined,
        savedModelId: editingModel?.id,
      });
      if (version !== probeVersion.current) return;
      setPingResult(probe);
    } catch {
      if (version === probeVersion.current) {
        setPingResult({ reachable: false, latencyMs: 0, message: 'Could not contact the AgentHub server.' });
      }
    } finally {
      if (version === probeVersion.current) setIsPinging(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    const payload = {
      name,
      modelId,
      endpointUrl,
      runtime,
      provider,
      category,
      description,
      authToken,
    };

    const validation = validateModelConnection(payload);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsSaving(true);
    try {
      if (editingModel) await updateModelConnection(editingModel.id, payload);
      else await connectModel(payload);
      handleClose();
    } catch (error) {
      setErrors({ request: error instanceof Error ? error.message : 'Could not save the model connection.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!editingModel || isSaving) return;
    setErrors({});
    setIsSaving(true);
    try {
      await disconnectModel(editingModel.id);
      handleClose();
    } catch {
      setErrors({ request: 'Could not disconnect the model.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#26251e]/40 backdrop-blur-sm select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-model-modal-title"
    >
      <div className="w-full max-w-xl rounded-3xl border border-[#e7e2d9] bg-[#fffdfa] p-6 space-y-5 shadow-2xl text-[#282820] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#e7e2d9]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#e9f2eb] text-[#1f6b5f] border border-[#166b66]/25">
              <Plug className="w-5 h-5" />
            </div>
            <div>
              <h3 id="connect-model-modal-title" className="text-base font-semibold text-[#282820] tracking-tight">
                {editingModel ? 'Manage Connection' : 'Connect an Agent or Model'}
              </h3>
              <p className="text-xs text-[#665f54] mt-0.5">
                {editingModel
                  ? 'Update the endpoint, runtime, or credential.'
                  : 'Connect Hermes, OpenClaw, Gemini, or another local or cloud endpoint. Codex and Claude Code are added from a computer in Connections.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="text-[#665f54] hover:text-[#282820] p-1 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Provider Quick Presets */}
          <div className="space-y-1.5">
            <label className="font-semibold text-[#4b4941] block">Provider</label>
            <div className="grid grid-cols-3 gap-2">
              {MODEL_PROVIDERS.filter(p => !isLocalAgentProvider(p) || p === provider).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleSelectProvider(p)}
                  aria-pressed={provider === p}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-medium transition-all text-center ${
                    provider === p
                      ? 'bg-[#e9f2eb] border-[#08666c] text-[#1f6b5f] font-semibold shadow-sm'
                      : 'bg-[#fffdfa] border-[#e7e2d9] text-[#665f54] hover:text-[#282820]'
                  }`}
                >
                  {p === 'OpenAI-Compatible' ? 'OpenAI / Compatible' : p === 'Codex CLI' ? 'Codex (ChatGPT)' : p === 'Claude Code' ? 'Claude (subscription)' : p}
                </button>
              ))}
            </div>
          </div>

          {/* Connection Display Name */}
          <div className="space-y-1.5">
            <label htmlFor="model-conn-name" className="font-semibold text-[#4b4941] block">
              Connection Display Name *
            </label>
            <input
              id="model-conn-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Name this connection"
              className="w-full px-3 py-2 rounded-xl bg-[#faf8f4] border border-[#e7e2d9] text-[#282820] placeholder-[#777064] focus:outline-none focus:border-[#08666c] text-xs"
            />
            {errors.name && (
              <p className="text-xs text-[#922d1d] flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>{errors.name}</span>
              </p>
            )}
          </div>

          {isLocal && <p className="rounded-2xl border border-[#e7e2d9] bg-[#faf8f4] p-3.5 text-sm text-[#4b4941]">This agent runs on one of your computers. Install, sign in, or revoke it from <strong className="font-semibold">Connections</strong>.</p>}

          {/* Runtime Environment + Category */}
          <div className={`grid grid-cols-1 gap-3 ${isLocal ? '' : 'sm:grid-cols-2'}`}>
            <div className="space-y-1.5" hidden={isLocal}>
              <label htmlFor="model-conn-runtime" className="font-semibold text-[#4b4941] block">
                Hosting Runtime
              </label>
              <div className="relative">
                <select
                  id="model-conn-runtime"
                  value={runtime}
                  onChange={e => setRuntime(e.target.value as ModelRuntime)}
                  className="w-full px-3 py-2 rounded-xl bg-[#faf8f4] border border-[#e7e2d9] text-[#282820] text-xs focus:outline-none focus:border-[#08666c]"
                >
                  <option value="Local Workstation">Local Workstation</option>
                  <option value="Self-Hosted vLLM">Self-Hosted vLLM</option>
                  <option value="Self-Hosted Server">Self-Hosted Server</option>
                  <option value="Cloud API">Cloud API</option>
                  <option value="Kubernetes Cluster">Kubernetes Cluster</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="model-conn-category" className="font-semibold text-[#4b4941] block">
                Workspace Category
              </label>
              <select
                id="model-conn-category"
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#faf8f4] border border-[#e7e2d9] text-[#282820] text-xs focus:outline-none focus:border-[#08666c]"
              >
                <option value="Engineering">Engineering</option>
                <option value="Communication">Communication</option>
                <option value="Design">Design</option>
                <option value="Search">Search</option>
              </select>
            </div>
          </div>

          {/* Model ID & Endpoint URL */}
          <div className={`grid grid-cols-1 gap-3 ${isLocal ? '' : 'sm:grid-cols-2'}`}>
            <div className="space-y-1.5">
              <label htmlFor="model-conn-id" className="font-semibold text-[#4b4941] block">
                {isCodexCli ? 'Codex model' : isClaude ? 'Claude model' : isAgentGatewayProvider(provider) ? 'Target Agent ID *' : 'Target Model ID *'}
              </label>
              <input
                id="model-conn-id"
                type="text"
                value={modelId}
                onChange={e => setModelId(e.target.value)}
                placeholder={PROVIDER_DEFAULTS[provider].modelId ?? 'Model ID from your provider'}
                list="available-model-ids"
                className="w-full px-3 py-2 rounded-xl bg-[#faf8f4] border border-[#e7e2d9] text-[#282820] font-mono placeholder-[#777064] focus:outline-none focus:border-[#08666c] text-xs"
              />
              {isCodexCli && <p className="text-[#665f54]">Use “default” for your Codex default model, or enter a model name.</p>}
              {isClaude && <p className="text-[#665f54]">Use “default”, or “sonnet”, “opus” or “haiku”.</p>}
              <datalist id="available-model-ids">
                {pingResult?.modelIds?.map(id => <option key={id} value={id} />)}
              </datalist>
              {errors.modelId && (
                <p className="text-xs text-[#922d1d] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.modelId}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5" hidden={isLocal}>
              <label htmlFor="model-conn-url" className="font-semibold text-[#4b4941] block">
                Endpoint Base URL *
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="model-conn-url"
                  type="text"
                  value={endpointUrl}
                  onChange={e => {
                    clearProbe();
                    setEndpointUrl(e.target.value);
                  }}
                  placeholder={PROVIDER_DEFAULTS[provider].baseUrl}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#faf8f4] border border-[#e7e2d9] text-[#282820] font-mono placeholder-[#777064] focus:outline-none focus:border-[#08666c] text-xs"
                />
                <button
                  type="button"
                  onClick={handleTestPing}
                  disabled={isPinging || isSaving}
                  className="px-2.5 py-2 rounded-xl bg-[#f2eee6] hover:bg-[#ede9e0] text-[#282820] font-semibold text-xs border border-[#d8d3ca] shrink-0 flex items-center gap-1"
                  title="Fetch target IDs from this endpoint"
                >
                  {isPinging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-[#1f6b5f]" />}
                  <span>Find IDs</span>
                </button>
              </div>
              {errors.endpointUrl && (
                <p className="text-xs text-[#922d1d] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.endpointUrl}</span>
                </p>
              )}
            </div>
          </div>

          <p className="text-[#665f54]" hidden={isLocal}>
            {provider === 'Hermes'
              ? 'Use the Hermes API server URL reachable from AgentHub and enter the Hermes API server key below.'
              : provider === 'OpenClaw'
                ? 'Enable Chat Completions on the OpenClaw gateway and use its private URL and bearer token.'
                : 'Use a hostname or IP that the AgentHub server can reach. Localhost refers to the server or container running AgentHub.'}
          </p>

          {pingResult && (
            <div
              role="status"
              className={`p-2.5 rounded-xl border font-mono text-xs flex items-center justify-between gap-2 ${
                pingResult.reachable
                  ? 'bg-[#e9f2eb] border-[#166b66]/25 text-[#1f6b5f]'
                  : 'bg-[#f7eed7] border-[#987529]/25 text-[#8a6418]'
              }`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                {pingResult.reachable ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1f6b5f] shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-[#8a6418] shrink-0" />
                )}
                <span>
                  {pingResult.message} {pingResult.modelIds?.length ? 'Select an ID from the suggestions or type it in.' : ''}
                </span>
              </span>
              {pingResult.latencyMs > 0 && <span className="font-semibold shrink-0">{pingResult.latencyMs} ms</span>}
            </div>
          )}

          <div className="p-3.5 rounded-2xl bg-[#fffdfa] border border-[#e7e2d9] space-y-2" hidden={isLocal}>
            <label htmlFor="model-conn-key" className="font-semibold text-[#4b4941] flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#665f54]" />
              <span>{isClaude ? 'Claude Code token' : 'API key or bearer token'}</span>
            </label>
            <input
              id="model-conn-key"
              type="password"
              autoComplete="new-password"
              value={authToken}
              onChange={e => {
                clearProbe();
                setAuthToken(e.target.value);
              }}
              placeholder={isClaude ? (editingModel ? 'Leave blank to keep the saved token' : 'sk-ant-oat01-…') : editingModel ? 'Leave blank to keep the key for this provider and host' : 'Enter a key if your provider requires one'}
              className="w-full px-3 py-2 rounded-xl bg-[#fffdfa] border border-[#d8d3ca] text-[#282820] font-mono placeholder-[#777064] focus:outline-none focus:border-[#08666c] text-xs"
            />
            {errors.authToken && <p role="alert" className="text-[#922d1d]">{errors.authToken}</p>}
            <p className="text-[#665f54]">{isClaude ? 'The token is encrypted on the server. It lasts about a year; run setup-token again to replace it.' : 'Saved keys are encrypted on the server.'}</p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="model-conn-desc" className="font-semibold text-[#4b4941] block">
              Workload Scope & Notes
            </label>
            <textarea
              id="model-conn-desc"
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what repositories, queues, or pipelines this connected model handles..."
              className="w-full px-3 py-2 rounded-xl bg-[#faf8f4] border border-[#e7e2d9] text-[#282820] placeholder-[#777064] focus:outline-none focus:border-[#08666c] text-xs resize-none"
            />
          </div>

          {errors.request && <p role="alert" className="text-[#922d1d]">{errors.request}</p>}

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#e7e2d9]">
            <div>
              {editingModel && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={isSaving}
                  className="px-3.5 py-2 rounded-xl bg-[#f9ece4] hover:bg-[#f9ece4] border border-[#a44e32]/25 text-[#922d1d] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Disconnect Model</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-[#f2eee6] hover:bg-[#ede9e0] text-[#4b4941] text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-[#08666c] hover:bg-[#0a7a80] disabled:cursor-not-allowed disabled:opacity-50 text-white text-xs font-semibold transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Plug className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving…' : editingModel ? 'Save Connection' : 'Connect'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
