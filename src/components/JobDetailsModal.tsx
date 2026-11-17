import React, { useState } from 'react';
import { useNeuro, NeuroJob } from '../context/NeuroContext';
import { 
  Briefcase, 
  X, 
  Bot, 
  User, 
  Clock, 
  Database, 
  ShieldCheck, 
  Zap, 
  CheckCircle2, 
  PauseCircle, 
  Play, 
  AlertTriangle,
  RotateCcw,
  Sparkles
} from 'lucide-react';

export function JobDetailsModal() {
  const { 
    activeJobDetails, 
    setActiveJobDetails, 
    agents, 
    teamMembers, 
    assignJob, 
    updateJobStatus,
    autoAssignJobToIdleAgent 
  } = useNeuro();

  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignType, setReassignType] = useState<'agent' | 'user'>('agent');
  const [reassignTargetId, setReassignTargetId] = useState('');

  if (!activeJobDetails) return null;

  const job = activeJobDetails;

  const handleReassign = () => {
    if (!reassignTargetId) return;

    if (reassignType === 'agent') {
      const targetAgent = agents.find(a => a.id === reassignTargetId);
      if (targetAgent) {
        assignJob(job.id, 'agent', targetAgent.id, targetAgent.name);
        setActiveJobDetails({
          ...job,
          assignedType: 'agent',
          assignedToId: targetAgent.id,
          assignedToName: targetAgent.name,
          status: 'in_progress'
        });
      }
    } else {
      const targetUser = teamMembers.find(u => u.id === reassignTargetId);
      if (targetUser) {
        assignJob(job.id, 'user', targetUser.id, targetUser.name);
        setActiveJobDetails({
          ...job,
          assignedType: 'user',
          assignedToId: targetUser.id,
          assignedToName: targetUser.name,
          status: 'in_progress'
        });
      }
    }

    setIsReassigning(false);
  };

  const handleAutoAssign = async () => {
    const res = await autoAssignJobToIdleAgent(job.id);
    if (res.success && res.agentName) {
      setActiveJobDetails({
        ...job,
        assignedType: 'agent',
        assignedToName: res.agentName,
        status: 'in_progress'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-2xl rounded-3xl border border-[#2B2D31] bg-[#18191B] p-6 space-y-5 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        
        {/* Top Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#2A2B2E]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                job.priority === 'critical' ? 'bg-red-950/80 text-red-400 border border-red-800/60' :
                job.priority === 'high' ? 'bg-amber-950/80 text-amber-400 border border-amber-800/60' :
                job.priority === 'medium' ? 'bg-blue-950/80 text-blue-400 border border-blue-800/60' :
                'bg-neutral-800 text-neutral-400 border border-neutral-700'
              }`}>
                {job.priority} Priority
              </span>

              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                job.status === 'in_progress' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' :
                job.status === 'queued' ? 'bg-amber-950/80 text-amber-400 border border-amber-800/60' :
                job.status === 'completed' ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60' :
                'bg-neutral-800 text-neutral-400 border border-neutral-700'
              }`}>
                {job.status.replace('_', ' ')}
              </span>

              <span className="px-2 py-0.5 rounded text-[10px] bg-[#242528] text-neutral-300 border border-[#34363C]">
                {job.category}
              </span>
            </div>

            <h2 className="text-lg font-bold text-white tracking-tight">
              {job.title}
            </h2>
          </div>

          <button
            onClick={() => setActiveJobDetails(null)}
            className="text-neutral-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description & Payload Spec */}
        <div className="space-y-3 text-xs">
          <div>
            <h4 className="font-semibold text-neutral-400 uppercase font-mono text-[11px] mb-1">
              Job Objective & Requirements
            </h4>
            <p className="text-neutral-200 leading-relaxed bg-[#121315] p-3 rounded-xl border border-[#26272B]">
              {job.description}
            </p>
          </div>

          {job.payloadSpec && (
            <div>
              <h4 className="font-semibold text-neutral-400 uppercase font-mono text-[11px] mb-1">
                Payload Spec & System Invariants
              </h4>
              <pre className="p-3 rounded-xl bg-[#0F1012] border border-[#222327] font-mono text-[11px] text-blue-300 whitespace-pre-wrap leading-relaxed">
                {job.payloadSpec}
              </pre>
            </div>
          )}
        </div>

        {/* Assignee Card & Quick Reassignment */}
        <div className="p-4 rounded-2xl bg-[#141517] border border-[#26272B] space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-neutral-300 uppercase tracking-wider">
              Assigned Executor
            </span>

            {!isReassigning && (
              <button
                onClick={() => {
                  setIsReassigning(true);
                  setReassignType('agent');
                  setReassignTargetId(agents[0]?.id || '');
                }}
                className="text-xs text-orange-400 hover:underline font-semibold"
              >
                Reassign Task
              </button>
            )}
          </div>

          {!isReassigning ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  job.assignedType === 'agent' 
                    ? 'bg-orange-950/40 border-orange-500/40 text-orange-400' 
                    : job.assignedType === 'user'
                    ? 'bg-blue-950/40 border-blue-500/40 text-blue-400'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                }`}>
                  {job.assignedType === 'agent' ? (
                    <Bot className="w-5 h-5" />
                  ) : job.assignedType === 'user' ? (
                    <User className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>

                <div>
                  <div className="text-sm font-bold text-white">
                    {job.assignedToName || 'Unassigned / Queued'}
                  </div>
                  <div className="text-xs text-neutral-400 font-mono">
                    {job.assignedType === 'agent' ? 'Autonomous AI Agent' : job.assignedType === 'user' ? (job.assignedToRole || 'Team Member') : 'Awaiting worker'}
                  </div>
                </div>
              </div>

              {job.assignedType === 'unassigned' && (
                <button
                  onClick={handleAutoAssign}
                  className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Auto-Assign to Idle Agent</span>
                </button>
              )}
            </div>
          ) : (
            /* Reassignment form */
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReassignType('agent');
                    setReassignTargetId(agents[0]?.id || '');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    reassignType === 'agent' ? 'bg-orange-600 text-white' : 'bg-[#222327] text-neutral-400'
                  }`}
                >
                  To AI Agent
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setReassignType('user');
                    setReassignTargetId(teamMembers[0]?.id || '');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    reassignType === 'user' ? 'bg-blue-600 text-white' : 'bg-[#222327] text-neutral-400'
                  }`}
                >
                  To Team Member
                </button>
              </div>

              {reassignType === 'agent' ? (
                <select
                  value={reassignTargetId}
                  onChange={e => setReassignTargetId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1C1F] border border-[#303238] text-white text-xs"
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} — [{a.status.toUpperCase()}] ({a.model})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={reassignTargetId}
                  onChange={e => setReassignTargetId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1C1F] border border-[#303238] text-white text-xs"
                >
                  {teamMembers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsReassigning(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#242528] text-neutral-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReassign}
                  className="px-3.5 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-bold"
                >
                  Confirm Reassignment
                </button>
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
              <span>Execution Progress</span>
              <span className="font-bold text-white">{job.progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#202125] overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-300"
                style={{ width: `${job.progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Execution Logs Timeline */}
        <div className="space-y-2">
          <h4 className="font-semibold text-neutral-400 uppercase font-mono text-[11px]">
            Audit Traces & Runtime Logs ({job.logs.length})
          </h4>
          <div className="space-y-1.5 max-h-40 overflow-y-auto p-3 rounded-xl bg-[#111214] border border-[#222327]">
            {job.logs.map((log, index) => (
              <div key={index} className="flex items-start gap-2 text-[11px] font-mono">
                <span className="text-neutral-500 shrink-0">[{log.timestamp}]</span>
                <span className={
                  log.level === 'success' ? 'text-emerald-400' :
                  log.level === 'warn' ? 'text-amber-400' :
                  'text-neutral-300'
                }>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[#26272A] text-xs">
          <div className="flex items-center gap-2 text-neutral-400 font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>Target: {job.deadline || 'ASAP'}</span>
          </div>

          <div className="flex items-center gap-2">
            {job.status === 'in_progress' && (
              <>
                <button
                  onClick={() => {
                    updateJobStatus(job.id, 'paused');
                    setActiveJobDetails({ ...job, status: 'paused' });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#25262A] hover:bg-[#2F3035] text-neutral-300 font-semibold flex items-center gap-1.5"
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
                <button
                  onClick={() => {
                    updateJobStatus(job.id, 'completed');
                    setActiveJobDetails({ ...job, status: 'completed', progressPercent: 100 });
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark Done</span>
                </button>
              </>
            )}

            {job.status === 'paused' && (
              <button
                onClick={() => {
                  updateJobStatus(job.id, 'in_progress');
                  setActiveJobDetails({ ...job, status: 'in_progress' });
                }}
                className="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Resume</span>
              </button>
            )}

            {job.status === 'queued' && (
              <button
                onClick={handleAutoAssign}
                className="px-4 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Dispatch to Idle Agent</span>
              </button>
            )}

            <button
              onClick={() => setActiveJobDetails(null)}
              className="px-4 py-1.5 rounded-xl bg-[#242528] hover:bg-[#2C2D31] text-white font-semibold"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
