import React, { useState } from 'react';
import { useEscapeKey } from '../lib/useEscapeKey';
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

  useEscapeKey(Boolean(activeJobDetails), () => setActiveJobDetails(null));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#26251e]/40 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-2xl rounded-3xl border border-[#e7e2d9] bg-[#fffdfa] p-6 space-y-5 shadow-2xl text-[#282820] max-h-[90vh] overflow-y-auto">
        
        {/* Top Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#e7e2d9]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold uppercase tracking-wider ${
                job.priority === 'critical' ? 'bg-[#f9ece4] text-[#922d1d] border border-[#a44e32]/25' :
                job.priority === 'high' ? 'bg-[#f7eed7] text-[#8a6418] border border-[#987529]/25' :
                job.priority === 'medium' ? 'bg-[#e8eef6] text-[#2f5d8a] border border-[#2f5d8a]/25' :
                'bg-[#ede9e0] text-[#665f54] border border-[#d8d3ca]'
              }`}>
                {job.priority} Priority
              </span>

              <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold uppercase ${
                job.status === 'in_progress' ? 'bg-[#e9f2eb] text-[#1f6b5f] border border-[#166b66]/25' :
                job.status === 'queued' ? 'bg-[#f7eed7] text-[#8a6418] border border-[#987529]/25' :
                job.status === 'completed' ? 'bg-[#e8eef6] text-[#2f5d8a] border border-[#2f5d8a]/25' :
                'bg-[#ede9e0] text-[#665f54] border border-[#d8d3ca]'
              }`}>
                {job.status.replace('_', ' ')}
              </span>

              <span className="px-2 py-0.5 rounded text-xs bg-[#f2eee6] text-[#4b4941] border border-[#d8d3ca]">
                {job.category}
              </span>
            </div>

            <h2 className="text-lg font-semibold text-[#282820] tracking-tight">
              {job.title}
            </h2>
          </div>

          <button
            onClick={() => setActiveJobDetails(null)}
            className="text-[#665f54] hover:text-[#282820] p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description & Payload Spec */}
        <div className="space-y-3 text-xs">
          <div>
            <h4 className="font-semibold text-[#665f54] text-xs mb-1">
              Job Objective & Requirements
            </h4>
            <p className="text-[#282820] leading-relaxed bg-[#fffdfa] p-3 rounded-xl border border-[#e7e2d9]">
              {job.description}
            </p>
          </div>

          {job.payloadSpec && (
            <div>
              <h4 className="font-semibold text-[#665f54] text-xs mb-1">
                Payload Spec & System Invariants
              </h4>
              <pre className="p-3 rounded-xl bg-[#faf8f4] border border-[#e7e2d9] font-mono text-xs text-[#2f5d8a] whitespace-pre-wrap leading-relaxed">
                {job.payloadSpec}
              </pre>
            </div>
          )}
        </div>

        {/* Assignee Card & Quick Reassignment */}
        <div className="p-4 rounded-2xl bg-[#fffdfa] border border-[#e7e2d9] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#4b4941]">
              Assigned Executor
            </span>

            {!isReassigning && (
              <button
                onClick={() => {
                  setIsReassigning(true);
                  setReassignType('agent');
                  setReassignTargetId(agents[0]?.id || '');
                }}
                className="text-xs text-[#08666c] hover:underline font-semibold"
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
                    ? 'bg-[#e9f2eb] border-[#166b66]/25 text-[#08666c]' 
                    : job.assignedType === 'user'
                    ? 'bg-[#e8eef6] border-[#2f5d8a]/25 text-[#2f5d8a]'
                    : 'bg-[#ede9e0] border-[#d8d3ca] text-[#665f54]'
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
                  <div className="text-sm font-semibold text-[#282820]">
                    {job.assignedToName || 'Unassigned / Queued'}
                  </div>
                  <div className="text-xs text-[#665f54] font-mono">
                    {job.assignedType === 'agent' ? 'Autonomous AI Agent' : job.assignedType === 'user' ? (job.assignedToRole || 'Team Member') : 'Awaiting worker'}
                  </div>
                </div>
              </div>

              {job.assignedType === 'unassigned' && (
                <button
                  onClick={handleAutoAssign}
                  className="px-3 py-1.5 rounded-xl bg-[#08666c] hover:bg-[#0a7a80] text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
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
                    reassignType === 'agent' ? 'bg-[#08666c] text-white' : 'bg-[#f2eee6] text-[#665f54]'
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
                    reassignType === 'user' ? 'bg-[#2f5d8a] text-white' : 'bg-[#f2eee6] text-[#665f54]'
                  }`}
                >
                  To Team Member
                </button>
              </div>

              {reassignType === 'agent' ? (
                <select
                  value={reassignTargetId}
                  onChange={e => setReassignTargetId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#fffdfa] border border-[#d8d3ca] text-[#282820] text-xs"
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
                  className="w-full px-3 py-2 rounded-xl bg-[#fffdfa] border border-[#d8d3ca] text-[#282820] text-xs"
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
                  className="px-3 py-1.5 rounded-lg bg-[#f2eee6] text-[#4b4941] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReassign}
                  className="px-3.5 py-1.5 rounded-lg bg-[#08666c] text-white text-xs font-semibold"
                >
                  Confirm Reassignment
                </button>
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-xs font-mono text-[#665f54]">
              <span>Execution Progress</span>
              <span className="font-semibold text-[#282820]">{job.progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#f2eee6] overflow-hidden">
              <div 
                className="h-full bg-[#08666c] transition-all duration-300"
                style={{ width: `${job.progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Execution Logs Timeline */}
        <div className="space-y-2">
          <h4 className="font-semibold text-[#665f54] text-xs">
            Audit Traces & Runtime Logs ({job.logs.length})
          </h4>
          <div className="space-y-1.5 max-h-40 overflow-y-auto p-3 rounded-xl bg-[#faf8f4] border border-[#e7e2d9]">
            {job.logs.map((log, index) => (
              <div key={index} className="flex items-start gap-2 text-xs font-mono">
                <span className="text-[#777064] shrink-0">[{log.timestamp}]</span>
                <span className={
                  log.level === 'success' ? 'text-[#1f6b5f]' :
                  log.level === 'warn' ? 'text-[#8a6418]' :
                  'text-[#4b4941]'
                }>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[#e7e2d9] text-xs">
          <div className="flex items-center gap-2 text-[#665f54] font-mono">
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
                  className="px-3 py-1.5 rounded-xl bg-[#f2eee6] hover:bg-[#ede9e0] text-[#4b4941] font-semibold flex items-center gap-1.5"
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
                <button
                  onClick={() => {
                    updateJobStatus(job.id, 'completed');
                    setActiveJobDetails({ ...job, status: 'completed', progressPercent: 100 });
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#08666c] hover:bg-[#08666c] text-white font-semibold flex items-center gap-1.5 shadow-sm"
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
                className="px-3.5 py-1.5 rounded-xl bg-[#08666c] hover:bg-[#0a7a80] text-white font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Resume</span>
              </button>
            )}

            {job.status === 'queued' && (
              <button
                onClick={handleAutoAssign}
                className="px-4 py-1.5 rounded-xl bg-[#08666c] hover:bg-[#0a7a80] text-white font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Dispatch to Idle Agent</span>
              </button>
            )}

            <button
              onClick={() => setActiveJobDetails(null)}
              className="px-4 py-1.5 rounded-xl bg-[#f2eee6] hover:bg-[#ede9e0] text-[#282820] font-semibold"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
