import React, { useState } from 'react';
import { useEscapeKey } from '../lib/useEscapeKey';
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
  const [assigneeType, setAssigneeType] = useState<'unassigned' | 'agent' | 'user'>('unassigned');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [payloadSpec, setPayloadSpec] = useState('');
  const [estimatedTokens, setEstimatedTokens] = useState(400);

  useEscapeKey(isOpen, onClose);
  if (!isOpen) return null;

  const selectedAgent = agents.find(agent => agent.id === selectedAgentId) ?? agents.find(agent => agent.status === 'Idle') ?? agents[0];
  const selectedUser = teamMembers.find(user => user.id === selectedUserId) ?? teamMembers[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let assignedToName: string | undefined = undefined;
    let assignedToId: string | undefined = undefined;

    if (assigneeType === 'agent') {
      assignedToId = selectedAgent?.id;
      assignedToName = selectedAgent?.name;
    } else if (assigneeType === 'user') {
      assignedToId = selectedUser?.id;
      assignedToName = selectedUser?.name;
    }

    if (assigneeType !== 'unassigned' && !assignedToId) return;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#26251e]/40 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-xl rounded-3xl border border-[#e7e2d9] bg-[#fffdfa] p-6 space-y-5 shadow-2xl text-[#282820] max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#e7e2d9]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#e9f2eb] text-[#08666c] border border-[#166b66]/25">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#282820] tracking-tight">
                Create & Dispatch New Job
              </h3>
              <p className="text-xs text-[#665f54] mt-0.5">
                Centralize autonomous workloads and prevent agents from remaining idle.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#665f54] hover:text-[#282820] p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Title */}
          <div className="space-y-1.5">
            <label className="font-semibold text-[#4b4941]">Job Title / Task Summary *</label>
            <input
              type="text"
              required
              placeholder="Name this job"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#faf8f4] border border-[#e7e2d9] text-[#282820] placeholder-[#777064] focus:outline-none focus:border-[#08666c] text-xs"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-semibold text-[#4b4941]">Description & Objective</label>
            <textarea
              rows={2}
              placeholder="Detail what needs to be executed, expected artifacts, and compliance constraints..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#faf8f4] border border-[#e7e2d9] text-[#282820] placeholder-[#777064] focus:outline-none focus:border-[#08666c] text-xs resize-none"
            />
          </div>

          {/* Category & Priority Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-[#4b4941]">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[#faf8f4] border border-[#e7e2d9] text-[#282820] text-xs focus:outline-none focus:border-[#08666c]"
              >
                <option value="Engineering">Engineering</option>
                <option value="Communication">Communication</option>
                <option value="Design">Design</option>
                <option value="Search">Search</option>
                <option value="DataOps">DataOps</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-[#4b4941]">Priority Level</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[#faf8f4] border border-[#e7e2d9] text-[#282820] text-xs focus:outline-none focus:border-[#08666c]"
              >
                <option value="critical">Critical (Blocking)</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Assignee Type Selector */}
          <div className="space-y-2 pt-1 border-t border-[#e7e2d9]">
            <label className="font-semibold text-[#4b4941] flex items-center justify-between">
              <span>Assign To (Prevent Idle Latency)</span>
              <span className="text-xs font-normal text-[#08666c]">
                Tip: Assigning to an idle agent awakens it!
              </span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAssigneeType('agent')}
                disabled={!agents.length}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all disabled:opacity-50 ${
                  assigneeType === 'agent'
                    ? 'bg-[#e9f2eb] border-[#08666c] text-[#08666c] font-semibold shadow-sm'
                    : 'bg-[#fffdfa] border-[#e7e2d9] text-[#665f54] hover:text-[#282820]'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Connected Model</span>
              </button>

              <button
                type="button"
                onClick={() => setAssigneeType('user')}
                disabled={!teamMembers.length}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all disabled:opacity-50 ${
                  assigneeType === 'user'
                    ? 'bg-[#e8eef6] border-[#2f5d8a] text-[#2f5d8a] font-semibold shadow-sm'
                    : 'bg-[#fffdfa] border-[#e7e2d9] text-[#665f54] hover:text-[#282820]'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Team Member</span>
              </button>

              <button
                type="button"
                onClick={() => setAssigneeType('unassigned')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all disabled:opacity-50 ${
                  assigneeType === 'unassigned'
                    ? 'bg-[#ede9e0] border-[#b9b3a7] text-[#282820] font-semibold shadow-sm'
                    : 'bg-[#fffdfa] border-[#e7e2d9] text-[#665f54] hover:text-[#282820]'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Queue / Unassigned</span>
              </button>
            </div>

            {/* Sub-selectors for chosen assignee type */}
            {assigneeType === 'agent' && (
              <div className="p-3 rounded-xl bg-[#fffdfa] border border-[#e7e2d9] space-y-2 animate-in fade-in duration-150">
                <span className="text-xs font-semibold text-[#665f54]">Select Connected Model:</span>
                <select
                  value={selectedAgent?.id ?? ''}
                  onChange={e => setSelectedAgentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#fffdfa] border border-[#d8d3ca] text-[#282820] text-xs focus:outline-none focus:border-[#08666c]"
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} — [{a.status.toUpperCase()}] ({a.model})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[#1f6b5f] flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  <span>Assigning this job will immediately activate the connected model and rank it on top.</span>
                </p>
              </div>
            )}

            {assigneeType === 'user' && (
              <div className="p-3 rounded-xl bg-[#fffdfa] border border-[#e7e2d9] space-y-2 animate-in fade-in duration-150">
                <span className="text-xs font-semibold text-[#665f54]">Select Team Member:</span>
                <select
                  value={selectedUser?.id ?? ''}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#fffdfa] border border-[#d8d3ca] text-[#282820] text-xs focus:outline-none focus:border-[#2f5d8a]"
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
              <label className="font-semibold text-[#4b4941]">Estimated Tokens Budget</label>
              <input
                type="number"
                value={estimatedTokens}
                onChange={e => setEstimatedTokens(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#faf8f4] border border-[#e7e2d9] text-[#282820] text-xs focus:outline-none focus:border-[#08666c] font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-[#4b4941]">Target SLA / Deadline</label>
              <input
                type="text"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                placeholder="e.g. Within 2 hours"
                className="w-full px-3 py-2 rounded-xl bg-[#faf8f4] border border-[#e7e2d9] text-[#282820] text-xs focus:outline-none focus:border-[#08666c]"
              />
            </div>
          </div>

          {/* Payload Spec */}
          <div className="space-y-1.5">
            <label className="font-semibold text-[#4b4941]">Payload Spec / Invariant Instructions</label>
            <textarea
              rows={2}
              placeholder="Add model inputs or execution instructions"
              value={payloadSpec}
              onChange={e => setPayloadSpec(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#faf8f4] border border-[#e7e2d9] text-[#282820] placeholder-[#777064] focus:outline-none focus:border-[#08666c] text-xs font-mono resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#e7e2d9]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#f2eee6] hover:bg-[#ede9e0] text-[#4b4941] text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#08666c] hover:bg-[#0a7a80] text-white text-xs font-semibold transition-colors shadow-sm flex items-center gap-1.5"
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
