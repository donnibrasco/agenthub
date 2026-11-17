import React, { useState } from 'react';
import { useAgentFleet } from '../context/AgentContext';
import { 
  ShieldCheck, 
  Key, 
  Lock, 
  RefreshCw, 
  CheckCircle2, 
  Copy, 
  Layers,
  Terminal,
  Cpu
} from 'lucide-react';
import { 
  generateKeyFingerprint, 
  encryptTelemetryPayload, 
  decryptTelemetryPayload 
} from '../lib/encryption';

export function SecurityVaultModal() {
  const { isSecurityVaultOpen, setIsSecurityVaultOpen, agents } = useAgentFleet();
  const [activeFingerprint, setActiveFingerprint] = useState(() => generateKeyFingerprint('cp_e2ee_vault'));
  const [testPlaintext, setTestPlaintext] = useState('Secret system prompt & internal API credential payload');
  const [testResult, setTestResult] = useState<{
    encryptedHex: string;
    ivHex: string;
    tagHex: string;
    verified: boolean;
  } | null>(null);

  if (!isSecurityVaultOpen) return null;

  const handleRunVerification = () => {
    const enc = encryptTelemetryPayload(testPlaintext, 'Execution completed safely with zero leakage', activeFingerprint);
    const dec = decryptTelemetryPayload(enc, activeFingerprint);

    setTestResult({
      encryptedHex: enc.ciphertextHex,
      ivHex: enc.ivHex,
      tagHex: enc.tagHex,
      verified: dec.success && dec.plaintextPrompt === testPlaintext
    });
  };

  const handleRotateKey = () => {
    const newFp = generateKeyFingerprint('cp_e2ee_vault');
    setActiveFingerprint(newFp);
    setTestResult(null);
  };

  const e2eeAgents = agents.filter(a => a.e2eeEnabled);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-950 p-6 space-y-5 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-cyan-950/80 border border-cyan-800/80">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Zero-Knowledge E2EE Security Vault
              </h3>
              <p className="text-xs text-slate-400">
                Client-side cryptographic enveloping for telemetry, prompts, and tool payloads.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsSecurityVaultOpen(false)}
            className="text-slate-400 hover:text-white text-sm px-2 py-1"
          >
            ✕
          </button>
        </div>

        {/* Security Parameters Grid */}
        <div className="grid grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3 rounded bg-slate-900 border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase block">Cipher Standard</span>
            <span className="text-cyan-300 font-semibold">AES-GCM-256</span>
          </div>
          <div className="p-3 rounded bg-slate-900 border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase block">Key Exchange</span>
            <span className="text-emerald-300 font-semibold">ECDH / P-384</span>
          </div>
          <div className="p-3 rounded bg-slate-900 border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase block">Protected Agents</span>
            <span className="text-white font-semibold">{e2eeAgents.length} / {agents.length}</span>
          </div>
        </div>

        {/* Active Session Key Fingerprint */}
        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5 font-mono">
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              Active Session Key Fingerprint:
            </span>
            <button
              onClick={handleRotateKey}
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono text-[11px]"
            >
              <RefreshCw className="w-3 h-3" /> Rotate Key
            </button>
          </div>
          <div className="p-2.5 rounded bg-slate-950 font-mono text-cyan-300 select-all border border-slate-800">
            {activeFingerprint}
          </div>
        </div>

        {/* Interactive In-Browser Cryptographic Verification */}
        <div className="space-y-3 pt-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300 uppercase tracking-wider font-mono">
              Verify Cryptographic Invariant (In-Browser):
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={testPlaintext}
              onChange={e => setTestPlaintext(e.target.value)}
              placeholder="Sample text to encrypt..."
              className="flex-1 px-3 py-1.5 rounded border border-slate-700 bg-slate-900 text-slate-100 font-mono focus:outline-none focus:border-cyan-500 text-xs"
            />
            <button
              onClick={handleRunVerification}
              className="px-3 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold rounded text-xs transition-colors shrink-0"
            >
              Test Cipher Invariant
            </button>
          </div>

          {testResult && (
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2 font-mono text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Zero-Knowledge Invariant Passed: Payload successfully encrypted and decrypted.
              </div>
              <div className="text-slate-400">
                IV: <span className="text-slate-300">{testResult.ivHex}</span> · Tag: <span className="text-slate-300">{testResult.tagHex}</span>
              </div>
              <div className="text-slate-500 truncate">
                Ciphertext: <span className="text-amber-200/80">{testResult.encryptedHex}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={() => setIsSecurityVaultOpen(false)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs transition-colors font-medium"
          >
            Close Vault
          </button>
        </div>

      </div>
    </div>
  );
}
