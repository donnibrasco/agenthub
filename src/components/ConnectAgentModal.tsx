import React, { useState } from 'react';
import { useAgentFleet } from '../context/AgentContext';
import { DeploymentRuntime } from '../types';
import { 
  Laptop, 
  Cloud, 
  Boxes, 
  Server, 
  Layers, 
  ShieldCheck, 
  Check, 
  ArrowRight, 
  Code2, 
  Copy,
  Terminal,
  Cpu
} from 'lucide-react';
import { generateKeyFingerprint } from '../lib/encryption';
import { generateSdkSnippet } from '../lib/orchestration';

export function ConnectAgentModal() {
  const { isConnectModalOpen, setIsConnectModalOpen, addAgent } = useAgentFleet();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [runtime, setRuntime] = useState<DeploymentRuntime>('local');
  const [name, setName] = useState('Local-Llama3-Workstation');
  const [hostEndpoint, setHostEndpoint] = useState('http://localhost:11434');
  const [model, setModel] = useState('llama3.3:70b');
  const [e2eeEnabled, setE2eeEnabled] = useState(true);
  const [keyFingerprint, setKeyFingerprint] = useState(() => generateKeyFingerprint('cp_e2ee'));
  const [snippetLang, setSnippetLang] = useState<'typescript' | 'python' | 'curl' | 'docker'>('typescript');
  const [tokenPrefix] = useState(() => `cp_live_${Math.random().toString(36).substring(2, 7)}`);

  if (!isConnectModalOpen) return null;

  const handleRuntimeSelect = (rt: DeploymentRuntime) => {
    setRuntime(rt);
    if (rt === 'local') {
      setName('Local-Ollama-Agent');
      setHostEndpoint('http://localhost:11434');
      setModel('qwen2.5-coder:32b');
    } else if (rt === 'cloud') {
      setName('Cloud-Vertex-Agent');
      setHostEndpoint('https://api.creativeprocess.io/v1');
      setModel('gemini-2.5-flash');
    } else if (rt === 'kubernetes') {
      setName('vLLM-K8s-Cluster-Node');
      setHostEndpoint('https://vllm-cluster.internal:8000');
      setModel('deepseek-r1-distill');
    } else if (rt === 'self-hosted') {
      setName('Docker-GPU-Worker');
      setHostEndpoint('http://gpu-worker-01:5000');
      setModel('llama3.3:70b');
    } else {
      setName('Edge-Proxy-Prober');
      setHostEndpoint('https://edge-prober.creativeprocess.net');
      setModel('llama-guard-3');
    }
    setStep(2);
  };

  const handleFinish = () => {
    addAgent({
      name,
      runtime,
      hostEndpoint,
      model,
      status: 'nominal',
      statusMessage: `Connected via ${runtime} telemetry handshake`,
      version: 'v1.0.0',
      e2eeEnabled,
      e2eeKeyFingerprint: e2eeEnabled ? keyFingerprint : 'cp_e2ee_unverified',
      authTokenPrefix: tokenPrefix,
      assignedTools: ['tool_code_interpreter', 'tool_vector_retriever'],
      tags: [runtime, 'custom-deployment'],
      health: {
        latencyMs: runtime === 'local' ? 320 : runtime === 'cloud' ? 210 : 640,
        uptimePercent: 99.9,
        errorRatePercent: 0.2,
        activeTasks: 1,
        totalRequests24h: 1
      },
      resourceUsage: {
        gpuVramMb: runtime === 'cloud' ? 0 : 16384,
        gpuVramTotalMb: runtime === 'cloud' ? 0 : 24576,
        cpuPercent: 24,
        memoryMb: 4096,
        memoryTotalMb: 16384
      }
    });

    setIsConnectModalOpen(false);
    setStep(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-950 p-6 space-y-5 shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-white">
              Connect New AI Agent Deployment
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Step {step} of 4: {step === 1 ? 'Select Runtime Environment' : step === 2 ? 'Agent Details & Endpoints' : step === 3 ? 'E2EE & Zero-Trust Security' : 'Embed SDK & Finish'}
            </p>
          </div>
          <button
            onClick={() => setIsConnectModalOpen(false)}
            className="text-slate-400 hover:text-white text-sm px-2 py-1"
          >
            ✕
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-2 text-xs font-mono">
          {(['Runtime', 'Config', 'E2EE Security', 'SDK Snippet'] as const).map((label, idx) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step > idx + 1 ? 'bg-cyan-500 text-slate-950 font-bold' : step === idx + 1 ? 'bg-cyan-900 border border-cyan-400 text-cyan-200' : 'bg-slate-900 text-slate-500'
              }`}>
                {idx + 1}
              </span>
              <span className={step === idx + 1 ? 'text-white font-medium' : 'text-slate-500'}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* STEP 1: Runtime Selector */}
        {step === 1 && (
          <div className="space-y-3 pt-2">
            <span className="text-xs text-slate-400 block font-medium">
              Where is this AI agent currently running?
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { type: 'local', title: 'Local Workstation', desc: 'Ollama, LMStudio, local CLI agents (M-series / RTX)', icon: Laptop },
                { type: 'cloud', title: 'Managed Cloud API', desc: 'Google Vertex AI, Cloud Run, Bedrock, Anthropic', icon: Cloud },
                { type: 'kubernetes', title: 'Kubernetes Cluster', desc: 'vLLM, TGI, Ray Serve on multi-GPU pods', icon: Boxes },
                { type: 'self-hosted', title: 'Self-Hosted Docker', desc: 'Private bare-metal GPU servers or on-prem nodes', icon: Server }
              ].map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    onClick={() => handleRuntimeSelect(item.type as DeploymentRuntime)}
                    className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 hover:border-cyan-500 hover:bg-slate-900 text-left transition-all space-y-1.5 group"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-semibold text-white group-hover:text-cyan-300">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: Endpoint Configuration */}
        {step === 2 && (
          <div className="space-y-4 pt-2 text-xs">
            <div className="space-y-1">
              <label className="text-slate-300 font-medium">Agent Display Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium">Host Endpoint URL</label>
              <input
                type="text"
                value={hostEndpoint}
                onChange={e => setHostEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium">Target Model ID</label>
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="e.g. qwen2.5-coder:32b, gemini-2.5-flash"
                className="w-full px-3 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex justify-between pt-3">
              <button
                onClick={() => setStep(1)}
                className="px-3 py-1.5 text-slate-400 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold rounded transition-colors"
              >
                Continue to Security
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: E2EE Security Setup */}
        {step === 3 && (
          <div className="space-y-4 pt-2 text-xs">
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold text-white">End-to-End Encryption (AES-GCM-256)</span>
                </div>
                <input
                  type="checkbox"
                  checked={e2eeEnabled}
                  onChange={e => setE2eeEnabled(e.target.checked)}
                  className="w-4 h-4 accent-cyan-400 cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                When enabled, prompts, completions, and tool outputs are encrypted on the agent host prior to transmission over telemetry channels. Only your authenticated dashboard client holds the decryption keys.
              </p>
            </div>

            {e2eeEnabled && (
              <div className="p-3.5 rounded bg-slate-950 border border-cyan-900/60 font-mono space-y-2">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Generated Key Fingerprint:</span>
                  <button
                    onClick={() => setKeyFingerprint(generateKeyFingerprint('cp_e2ee'))}
                    className="text-cyan-400 hover:underline text-[10px]"
                  >
                    Regenerate
                  </button>
                </div>
                <div className="text-cyan-300 bg-slate-900 p-2 rounded text-xs select-all">
                  {keyFingerprint}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-3">
              <button
                onClick={() => setStep(2)}
                className="px-3 py-1.5 text-slate-400 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold rounded transition-colors"
              >
                Continue to SDK Snippet
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: SDK Snippet & Finish */}
        {step === 4 && (
          <div className="space-y-4 pt-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-medium">Integration Snippet</span>
              <div className="flex items-center gap-1 p-1 bg-slate-900 rounded border border-slate-800">
                {(['typescript', 'python', 'curl', 'docker'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => setSnippetLang(lang)}
                    className={`px-2.5 py-0.5 text-[11px] font-mono rounded capitalize ${
                      snippetLang === lang ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto whitespace-pre leading-relaxed max-h-56">
              {generateSdkSnippet(snippetLang, {
                name,
                endpoint: hostEndpoint,
                token: `${tokenPrefix}_sec_${Date.now().toString(36)}`,
                e2ee: e2eeEnabled,
                fingerprint: keyFingerprint
              })}
            </pre>

            <div className="flex justify-between pt-3">
              <button
                onClick={() => setStep(3)}
                className="px-3 py-1.5 text-slate-400 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={handleFinish}
                className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold rounded transition-colors shadow-md shadow-cyan-950"
              >
                Verify & Register Agent
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
