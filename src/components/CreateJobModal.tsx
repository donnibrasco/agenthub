import React, { useState } from 'react';
import { useNeuro } from '../context/NeuroContext';
import { 
  Briefcase, 
  X, 
  Plus, 
  Sparkles, 
  Bot, 
  User, 
  Zap, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface CreateJobModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateJobModal({ isOpen, onClose }: CreateJobModalProps) {
  const { agents, teamMembers, createJob } = useNeuro();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'Engineering' | 'Communication' | 'Design' | 'Search' | 'DataOps'>('Engineering');
  const [priority, setPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('high');
  const [assigneeType, setAssigneeType] = useState<'unassigned' | 'agent' | 'user'>('agent');
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents.find(a => a.status === 'Idle')?.id || agents[0]?.id || '');
  const [selectedUserId, setSelectedUserId] = useState<string>(teamMembers[0]?.id || '');
  const [deadline, setDeadline] = useState('Within 2 hours');
  const [payloadSpec, setPayloadSpec] = useState('');
  const [estimatedTokens, setEstimatedTokens] = useState(400);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let assignedToName: string | undefined = undefined;
    let assignedToId: string | undefined = undefined;

    if (assigneeType === 'agent') {
      const targetAgent = agents.find(a => a.id === selectedAgentId);
      assignedToId = targetAgent?.id;
      assignedToName = targetAgent?.name;
    } else if (assigneeType === 'user') {
      const targetUser = teamMembers.find(u => u.id === selectedUserId);
      assignedToId = targetUser?.id;
      assignedToName = targetUser?.name;
    }

    createJob({
      title,
      description,
      category,
      priority,
      assignedType: assigneeType,
      assignedToId,
      assignedToName,
      deadline,
      payloadSpec,
      estimatedTokens: Number(estimatedTokens) || 350,
      status: assigneeType === 'unassigned' ? 'queued' : 'in_progress'
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-xl rounded-3xl border border-[#2B2D31] bg-[#18191B] p-6 space-y-5 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2A2B2E]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-600/20 text-orange-400 border border-orange-500/30">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Create & Dispatch New Job
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Centralize autonomous workloads and prevent agents from remaining idle.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Title */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-300">Job Title / Task Summary *</label>
            <input
              type="text"
              required
              placeholder="e.g. Audit AST invariants on PR #250 or Parse OpenAPI spec"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#111214] border border-[#2A2B2F] text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 text-xs"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-300">Description & Objective</label>
            <textarea
              rows={2}
              placeholder="Detail what needs to be executed, expected artifacts, and compliance constraints..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#111214] border border-[#2A2B2F] text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 text-xs resize-none"
            />
          </div>

          {/* Category & Priority Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-neutral-300">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[#111214] border border-[#2A2B2F] text-white text-xs focus:outline-none focus:border-orange-500"
              >
                <option value="Engineering">Engineering</option>
                <option value="Communication">Communication</option>
                <option value="Design">Design</option>
                <option value="Search">Search</option>
                <option value="DataOps">DataOps</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-neutral-300">Priority Level</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[#111214] border border-[#2A2B2F] text-white text-xs focus:outline-none focus:border-orange-500"
              >
                <option value="critical">Critical (Blocking)</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Assignee Type Selector */}
          <div className="space-y-2 pt-1 border-t border-[#26272A]">
            <label className="font-semibold text-neutral-300 flex items-center justify-between">
              <span>Assign To (Prevent Idle Latency)</span>
              <span className="text-[11px] font-normal text-orange-400">
                Tip: Assigning to an idle agent awakens it!
              </span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAssigneeType('agent')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                  assigneeType === 'agent'
                    ? 'bg-orange-950/50 border-orange-500 text-orange-300 font-semibold shadow-sm'
                    : 'bg-[#141517] border-[#2A2B2F] text-neutral-400 hover:text-white'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Connected Model</span>
              </button>

              <button
                type="button"
                onClick={() => setAssigneeType('user')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                  assigneeType === 'user'
                    ? 'bg-blue-950/50 border-blue-500 text-blue-300 font-semibold shadow-sm'
                    : 'bg-[#141517] border-[#2A2B2F] text-neutral-400 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Team Member</span>
              </button>

              <button
                type="button"
                onClick={() => setAssigneeType('unassigned')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                  assigneeType === 'unassigned'
                    ? 'bg-neutral-800 border-neutral-500 text-white font-semibold shadow-sm'
                    : 'bg-[#141517] border-[#2A2B2F] text-neutral-400 hover:text-white'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Queue / Unassigned</span>
              </button>
            </div>

            {/* Sub-selectors for chosen assignee type */}
            {assigneeType === 'agent' && (
              <div className="p-3 rounded-xl bg-[#121315] border border-[#27282C] space-y-2 animate-in fade-in duration-150">
                <span className="text-[11px] font-semibold text-neutral-400">Select Connected Model:</span>
                <select
                  value={selectedAgentId}
                  onChange={e => setSelectedAgentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#18191B] border border-[#303236] text-white text-xs focus:outline-none focus:border-orange-500"
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} — [{a.status.toUpperCase()}] ({a.model})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  <span>Assigning this job will immediately activate the connected model and rank it on top.</span>
                </p>
              </div>
            )}

            {assigneeType === 'user' && (
              <div className="p-3 rounded-xl bg-[#121315] border border-[#27282C] space-y-2 animate-in fade-in duration-150">
                <span className="text-[11px] font-semibold text-neutral-400">Select Team Member:</span>
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#18191B] border border-[#303236] text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  {teamMembers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Tokens & Deadline */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="font-semibold text-neutral-300">Estimated Tokens Budget</label>
              <input
                type="number"
                value={estimatedTokens}
                onChange={e => setEstimatedTokens(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#111214] border border-[#2A2B2F] text-white text-xs focus:outline-none focus:border-orange-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-neutral-300">Target SLA / Deadline</label>
              <input
                type="text"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                placeholder="e.g. Within 2 hours"
                className="w-full px-3 py-2 rounded-xl bg-[#111214] border border-[#2A2B2F] text-white text-xs focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Payload Spec */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-300">Payload Spec / Invariant Instructions</label>
            <textarea
              rows={2}
              placeholder="e.g. Target endpoint: https://api.creativeprocess.io/v1/sync --verify-ast"
              value={payloadSpec}
              onChange={e => setPayloadSpec(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#111214] border border-[#2A2B2F] text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 text-xs font-mono resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#26272A]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#242528] hover:bg-[#2C2D31] text-neutral-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Dispatch Job</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
