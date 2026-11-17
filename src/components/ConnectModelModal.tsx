import React, { useState, useEffect } from 'react';
import { useNeuro } from '../context/NeuroContext';
import {
  ModelRuntime,
  ModelProvider,
  validateModelConnection,
  generateConnectionFingerprint,
  normalizeEndpointDomain,
} from '../lib/modelConnection';
import {
  Plug,
  X,
  CheckCircle2,
  ShieldCheck,
  Activity,
  Server,
  Cloud,
  Laptop,
  Boxes,
  Trash2,
  KeyRound,
  AlertCircle,
  Loader2,
} from 'lucide-react';

const PROVIDER_DEFAULTS: Record<
  ModelProvider,
  { runtime: ModelRuntime; modelId: string; endpointUrl: string }
> = {
  Ollama: {
    runtime: 'Local Workstation',
    modelId: 'qwen2.5-coder:32b',
    endpointUrl: 'http://localhost:11434/v1',
  },
  vLLM: {
    runtime: 'Self-Hosted vLLM',
    modelId: 'deepseek-r1-distill-32b',
    endpointUrl: 'http://cluster.vllm.local:8000/v1',
  },
  Gemini: {
    runtime: 'Cloud API',
    modelId: 'gemini-2.5-flash',
    endpointUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  Anthropic: {
    runtime: 'Cloud API',
    modelId: 'claude-3-7-sonnet',
    endpointUrl: 'https://api.anthropic.com/v1',
  },
  DeepSeek: {
    runtime: 'Self-Hosted vLLM',
    modelId: 'deepseek-coder-v2',
    endpointUrl: 'https://api.deepseek.com/v1',
  },
  'OpenAI-Compatible': {
    runtime: 'Kubernetes Cluster',
    modelId: 'llama-3.3-70b-instruct',
    endpointUrl: 'http://inference.k8s.internal:8080/v1',
  },
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
  const [modelId, setModelId] = useState('qwen2.5-coder:32b');
  const [endpointUrl, setEndpointUrl] = useState('http://localhost:11434/v1');
  const [category, setCategory] = useState('Engineering');
  const [description, setDescription] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pingResult, setPingResult] = useState<{
    reachable: boolean;
    latency: number;
    domain: string;
    message: string;
  } | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  useEffect(() => {
    if (!isConnectModalOpen) return;
    setErrors({});
    setPingResult(null);
    setAuthToken('');

    if (editingModel) {
      setName(editingModel.name);
      setProvider(editingModel.provider || 'OpenAI-Compatible');
      setRuntime(editingModel.runtime || 'Self-Hosted vLLM');
      setModelId(editingModel.model);
      setEndpointUrl(editingModel.endpointUrl || `https://${editingModel.domain || 'localhost:11434'}/v1`);
      setCategory(editingModel.category || 'Engineering');
      setDescription(editingModel.description || '');
    } else {
      setName('');
      setProvider('Ollama');
      setRuntime(PROVIDER_DEFAULTS.Ollama.runtime);
      setModelId(PROVIDER_DEFAULTS.Ollama.modelId);
      setEndpointUrl(PROVIDER_DEFAULTS.Ollama.endpointUrl);
      setCategory('Engineering');
      setDescription('');
    }
  }, [isConnectModalOpen, editingModel]);

  if (!isConnectModalOpen) return null;

  const handleClose = () => {
    setIsConnectModalOpen(false);
    setEditingModel(null);
  };

  const handleSelectProvider = (nextProvider: ModelProvider) => {
    setProvider(nextProvider);
    if (!editingModel) {
      const preset = PROVIDER_DEFAULTS[nextProvider];
      setRuntime(preset.runtime);
      setModelId(preset.modelId);
      setEndpointUrl(preset.endpointUrl);
    }
  };

  const handleTestPing = async () => {
    const check = validateModelConnection({
      name: name || 'Probe Test',
      modelId: modelId || 'probe',
      endpointUrl,
      runtime,
      provider,
      category,
    });

    if (check.errors.endpointUrl) {
      setErrors(prev => ({ ...prev, endpointUrl: check.errors.endpointUrl }));
      return;
    }

    setErrors(prev => {
      const next = { ...prev };
      delete next.endpointUrl;
      return next;
    });
    setIsPinging(true);
    setPingResult(null);

    try {
      const probe = await probeEndpoint({
        endpointUrl,
        provider,
        authToken: authToken || undefined,
      });
      setPingResult({
        reachable: probe.reachable,
        latency: probe.latencyMs,
        domain: normalizeEndpointDomain(endpointUrl),
        message: probe.message,
      });
    } finally {
      setIsPinging(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    if (editingModel) {
      await updateModelConnection(editingModel.id, payload);
    } else {
      await connectModel(payload);
    }

    handleClose();
  };

  const handleDisconnect = async () => {
    if (!editingModel) return;
    await disconnectModel(editingModel.id);
    handleClose();
  };

  const liveFingerprint = generateConnectionFingerprint(`${endpointUrl}|${modelId}`);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-model-modal-title"
    >
      <div className="w-full max-w-xl rounded-3xl border border-[#2B2D31] bg-[#18191B] p-6 space-y-5 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2A2B2E]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Plug className="w-5 h-5" />
            </div>
            <div>
              <h3 id="connect-model-modal-title" className="text-base font-bold text-white tracking-tight">
                {editingModel ? 'Manage Connected Model' : 'Connect Existing Model'}
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                {editingModel
                  ? 'Update endpoint routing, runtime host, or disconnect this model.'
                  : 'Link an already-created local, self-hosted, or cloud model endpoint for telemetry and job routing.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Provider Quick Presets */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-300 block">Model Provider</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PROVIDER_DEFAULTS) as ModelProvider[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleSelectProvider(p)}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-medium transition-all text-center ${
                    provider === p
                      ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300 font-semibold shadow-sm'
                      : 'bg-[#121315] border-[#2A2B2F] text-neutral-400 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Connection Display Name */}
          <div className="space-y-1.5">
            <label htmlFor="model-conn-name" className="font-semibold text-neutral-300 block">
              Connection Display Name *
            </label>
            <input
              id="model-conn-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Local Mac Studio Qwen Reviewer"
              className="w-full px-3 py-2 rounded-xl bg-[#111214] border border-[#2A2B2F] text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 text-xs"
            />
            {errors.name && (
              <p className="text-[11px] text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>{errors.name}</span>
              </p>
            )}
          </div>

          {/* Runtime Environment + Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="model-conn-runtime" className="font-semibold text-neutral-300 block">
                Hosting Runtime
              </label>
              <div className="relative">
                <select
                  id="model-conn-runtime"
                  value={runtime}
                  onChange={e => setRuntime(e.target.value as ModelRuntime)}
                  className="w-full px-3 py-2 rounded-xl bg-[#111214] border border-[#2A2B2F] text-white text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="Local Workstation">Local Workstation</option>
                  <option value="Self-Hosted vLLM">Self-Hosted vLLM</option>
                  <option value="Cloud API">Cloud API</option>
                  <option value="Kubernetes Cluster">Kubernetes Cluster</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="model-conn-category" className="font-semibold text-neutral-300 block">
                Workspace Category
              </label>
              <select
                id="model-conn-category"
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#111214] border border-[#2A2B2F] text-white text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="Engineering">Engineering</option>
                <option value="Communication">Communication</option>
                <option value="Design">Design</option>
                <option value="Search">Search</option>
              </select>
            </div>
          </div>

          {/* Model ID & Endpoint URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="model-conn-id" className="font-semibold text-neutral-300 block">
                Target Model ID *
              </label>
              <input
                id="model-conn-id"
                type="text"
                value={modelId}
                onChange={e => setModelId(e.target.value)}
                placeholder="e.g. qwen2.5-coder:32b"
                className="w-full px-3 py-2 rounded-xl bg-[#111214] border border-[#2A2B2F] text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-emerald-500 text-xs"
              />
              {errors.modelId && (
                <p className="text-[11px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.modelId}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="model-conn-url" className="font-semibold text-neutral-300 block">
                Endpoint Base URL *
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="model-conn-url"
                  type="text"
                  value={endpointUrl}
                  onChange={e => setEndpointUrl(e.target.value)}
                  placeholder="http://localhost:11434/v1"
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#111214] border border-[#2A2B2F] text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-emerald-500 text-xs"
                />
                <button
                  type="button"
                  onClick={handleTestPing}
                  disabled={isPinging}
                  className="px-2.5 py-2 rounded-xl bg-[#25262B] hover:bg-[#31333A] text-neutral-200 font-semibold text-[11px] border border-[#363840] shrink-0 flex items-center gap-1"
                  title="Verify reachability & latency"
                >
                  {isPinging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>Ping</span>
                </button>
              </div>
              {errors.endpointUrl && (
                <p className="text-[11px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.endpointUrl}</span>
                </p>
              )}
            </div>
          </div>

          {pingResult && (
            <div
              className={`p-2.5 rounded-xl border font-mono text-[11px] flex items-center justify-between gap-2 ${
                pingResult.reachable
                  ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-300'
                  : 'bg-amber-950/50 border-amber-800/60 text-amber-300'
              }`}
            >
              <span className="flex items-center gap-1.5 min-w-0 truncate">
                {pingResult.reachable ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                )}
                <span className="truncate">
                  {pingResult.domain}: {pingResult.message}
                </span>
              </span>
              <span className="font-bold shrink-0">{pingResult.latency}ms RTT</span>
            </div>
          )}

          {/* Optional Auth Key + E2EE Fingerprint Preview */}
          <div className="p-3.5 rounded-2xl bg-[#121315] border border-[#26272B] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-neutral-400" />
                <span>Bearer Token / Auth Header (Optional)</span>
              </span>
              <span className="font-mono text-[10px] text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>{liveFingerprint}</span>
              </span>
            </div>
            <input
              type="password"
              value={authToken}
              onChange={e => setAuthToken(e.target.value)}
              placeholder={editingModel ? 'Leave blank to retain encrypted key' : 'sk-... or bearer token (encrypted locally)'}
              className="w-full px-3 py-2 rounded-xl bg-[#18191B] border border-[#2D2F35] text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-emerald-500 text-xs"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="model-conn-desc" className="font-semibold text-neutral-300 block">
              Workload Scope & Notes
            </label>
            <textarea
              id="model-conn-desc"
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what repositories, queues, or pipelines this connected model handles..."
              className="w-full px-3 py-2 rounded-xl bg-[#111214] border border-[#2A2B2F] text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 text-xs resize-none"
            />
          </div>

          {/* Runtime visual indicator strip */}
          <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono">
            {runtime === 'Local Workstation' && <Laptop className="w-3.5 h-3.5 text-emerald-400" />}
            {runtime === 'Self-Hosted vLLM' && <Server className="w-3.5 h-3.5 text-blue-400" />}
            {runtime === 'Cloud API' && <Cloud className="w-3.5 h-3.5 text-purple-400" />}
            {runtime === 'Kubernetes Cluster' && <Boxes className="w-3.5 h-3.5 text-orange-400" />}
            <span>
              Routing telemetry via {runtime} ({provider})
            </span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#26272A]">
            <div>
              {editingModel && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-3.5 py-2 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
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
                className="px-4 py-2 rounded-xl bg-[#242528] hover:bg-[#2C2D31] text-neutral-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Plug className="w-3.5 h-3.5" />
                <span>{editingModel ? 'Save Connection' : 'Connect Model'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
