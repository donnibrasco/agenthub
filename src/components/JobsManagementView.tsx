import React, { useState } from 'react';
import { useNeuro, NeuroJob } from '../context/NeuroContext';
import { calculateFleetUtilization } from '../lib/jobAssignment';
import { CreateJobModal } from './CreateJobModal';
import { JobDetailsModal } from './JobDetailsModal';
import { 
  Briefcase, 
  Plus, 
  Search, 
  Bot, 
  User, 
  Zap, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Database, 
  Layers, 
  Flame, 
  Radio,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export function JobsManagementView() {
  const { 
    jobs, 
    agents, 
    teamMembers, 
    searchQuery: globalSearchQuery,
    assignJob, 
    autoAssignJobToIdleAgent, 
    autoAssignAllQueuedJobs,
    setActiveJobDetails 
  } = useNeuro();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [assignmentNotice, setAssignmentNotice] = useState<string | null>(null);

  const fleetStats = calculateFleetUtilization(agents);
  const effectiveSearch = (searchQuery || globalSearchQuery).trim().toLowerCase();

  const filteredJobs = jobs.filter(job => {
    const matchesStatus = 
      filterStatus === 'all' || 
      (filterStatus === 'queued' && (job.status === 'queued' || job.assignedType === 'unassigned')) ||
      (filterStatus === 'in_progress' && job.status === 'in_progress') ||
      (filterStatus === 'agent' && job.assignedType === 'agent') ||
      (filterStatus === 'user' && job.assignedType === 'user') ||
      (filterStatus === 'completed' && job.status === 'completed');

    const matchesCategory = filterCategory === 'all' || job.category.toLowerCase() === filterCategory.toLowerCase();

    const matchesSearch = !effectiveSearch ||
      job.title.toLowerCase().includes(effectiveSearch) ||
      job.description.toLowerCase().includes(effectiveSearch) ||
      (job.assignedToName && job.assignedToName.toLowerCase().includes(effectiveSearch));

    return matchesStatus && matchesCategory && matchesSearch;
  });

  const handleAutoAssignAll = async () => {
    const count = await autoAssignAllQueuedJobs();
    if (count > 0) {
      setAssignmentNotice(`Dispatched ${count} pending jobs to idle models. All targeted models are now ACTIVE!`);
    } else {
      setAssignmentNotice('No idle models available or all queued jobs are currently assigned.');
    }
    setTimeout(() => setAssignmentNotice(null), 4000);
  };

  const handleQuickAssignAgent = (jobId: string, agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    assignJob(jobId, 'agent', agent.id, agent.name);
    setAssignmentNotice(`Job assigned to ${agent.name}. Agent is now Active!`);
    setTimeout(() => setAssignmentNotice(null), 3000);
  };

  return (
    <div className="space-y-6">
      
      {/* ─── Top Header Banner ─── */}
      <div className="rounded-3xl bg-[#18191B] border border-[#27282C] p-6 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/30">
                <Briefcase className="w-4 h-4" />
              </span>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Centralized Job & Workload Orchestrator
              </h1>
            </div>
            <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed">
              Dispatch queued engineering and operational tasks to idle agents to eliminate downtime. Assign to autonomous agents or human collaborators with real-time telemetry tracking.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleAutoAssignAll}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs tracking-wide transition-colors shadow-md"
              title="Automatically match all queued jobs with available idle connected models"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Auto-Assign to Idle Models</span>
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-xs tracking-wide transition-colors shadow-md"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create Job</span>
            </button>
          </div>
        </div>

        {/* Live Notification Bar */}
        {assignmentNotice && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in duration-200 font-mono">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{assignmentNotice}</span>
            </div>
            <button onClick={() => setAssignmentNotice(null)} className="text-neutral-400 hover:text-white">✕</button>
          </div>
        )}

        {/* ─── Fleet Utilization & Workload Stats ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#25262A]">
          <div className="p-3 rounded-2xl bg-[#121315] border border-[#232427]">
            <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Total Jobs</div>
            <div className="text-xl font-bold text-white mt-1">{jobs.length}</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">Centralized queue</div>
          </div>

          <div className="p-3 rounded-2xl bg-[#121315] border border-[#232427]">
            <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">In Progress</div>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              {jobs.filter(j => j.status === 'in_progress').length}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">Active execution</div>
          </div>

          <div className="p-3 rounded-2xl bg-[#121315] border border-[#232427]">
            <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Idle Agents Ready</div>
            <div className="text-xl font-bold text-amber-400 mt-1">
              {fleetStats.idleCount}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">Available to assign</div>
          </div>

          <div className="p-3 rounded-2xl bg-[#121315] border border-[#232427]">
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
              <span>Fleet Utilization</span>
              <span className="text-white font-bold">{fleetStats.utilizationRate}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#202124] overflow-hidden mt-2">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
                style={{ width: `${fleetStats.utilizationRate}%` }}
              />
            </div>
            <div className="text-[10px] text-neutral-500 mt-1">
              {fleetStats.activeCount} of {fleetStats.total} agents active
            </div>
          </div>
        </div>
      </div>

      {/* ─── Search and Filters Bar ─── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search jobs by title, payload or assignee..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#18191B] border border-[#2A2B2F] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 font-sans"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 font-medium text-xs">
          {[
            { id: 'all', label: 'All Jobs' },
            { id: 'queued', label: 'Queued (Needs Assignee)' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'agent', label: 'Assigned to Models' },
            { id: 'user', label: 'Assigned to Users' },
            { id: 'completed', label: 'Completed' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                filterStatus === tab.id
                  ? 'bg-neutral-200 text-neutral-900 font-bold shadow-sm'
                  : 'bg-[#18191B] text-neutral-400 hover:text-white border border-[#2A2B2F]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Jobs Feed & Assignment Cards ─── */}
      <div className="space-y-3">
        {filteredJobs.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#18191B] border border-[#27282C] space-y-3">
            <Briefcase className="w-10 h-10 text-neutral-500 mx-auto" />
            <p className="text-sm font-semibold text-neutral-300">No jobs match your search or filter.</p>
            <button
              onClick={() => { setSearchQuery(''); setFilterStatus('all'); }}
              className="text-xs text-orange-400 hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          filteredJobs.map(job => {
            const isUnassigned = job.assignedType === 'unassigned' || !job.assignedToName;
            const idleAgents = agents.filter(a => a.status === 'Idle');

            return (
              <div
                key={job.id}
                className="group relative p-4 rounded-2xl bg-[#18191B] hover:bg-[#1D1E22] border border-[#27282C] hover:border-neutral-700 transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Priority Flair */}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        job.priority === 'critical' ? 'bg-red-950/80 text-red-400 border border-red-800/60' :
                        job.priority === 'high' ? 'bg-amber-950/80 text-amber-400 border border-amber-800/60' :
                        job.priority === 'medium' ? 'bg-blue-950/80 text-blue-400 border border-blue-800/60' :
                        'bg-neutral-800 text-neutral-400 border border-neutral-700'
                      }`}>
                        {job.priority}
                      </span>

                      {/* Status */}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                        job.status === 'in_progress' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' :
                        job.status === 'queued' ? 'bg-amber-950/80 text-amber-400 border border-amber-800/60' :
                        job.status === 'completed' ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60' :
                        'bg-neutral-800 text-neutral-400 border border-neutral-700'
                      }`}>
                        {job.status.replace('_', ' ')}
                      </span>

                      {/* Category */}
                      <span className="px-2 py-0.5 rounded text-[10px] bg-[#242528] text-neutral-300 border border-[#34363C]">
                        {job.category}
                      </span>

                      <span className="text-xs text-neutral-500 font-mono">
                        Target: {job.deadline || 'ASAP'}
                      </span>
                    </div>

                    <h3 
                      onClick={() => setActiveJobDetails(job)}
                      className="text-sm sm:text-base font-bold text-white hover:text-orange-400 cursor-pointer transition-colors"
                    >
                      {job.title}
                    </h3>
                  </div>

                  {/* Right Action: Inspect Details */}
                  <button
                    onClick={() => setActiveJobDetails(job)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#242528] hover:bg-[#2F3035] text-neutral-200 text-xs font-semibold transition-colors self-start sm:self-auto shrink-0"
                  >
                    <span>View Details</span>
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                  </button>
                </div>

                <p className="text-xs text-neutral-400 leading-relaxed font-sans line-clamp-2">
                  {job.description}
                </p>

                {/* Assignment & Execution Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-[#252629] text-xs">
                  
                  {/* Assignee Box */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-mono text-neutral-500">Assignee:</span>

                    {job.assignedType === 'agent' ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-950/50 border border-orange-800/50 text-orange-300 font-medium">
                        <Bot className="w-3.5 h-3.5 text-orange-400" />
                        <span>{job.assignedToName}</span>
                        <span className="text-[10px] text-emerald-400 font-mono">(Agent Active)</span>
                      </div>
                    ) : job.assignedType === 'user' ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/50 border border-blue-800/50 text-blue-300 font-medium">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                        <span>{job.assignedToName}</span>
                        <span className="text-[10px] text-neutral-400 font-mono">({job.assignedToRole || 'User'})</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-950/60 border border-amber-800/50 text-amber-400">
                          ⚠ Unassigned Queue
                        </span>

                        {/* Quick Auto-Assign Button */}
                        <button
                          onClick={async () => {
                            const res = await autoAssignJobToIdleAgent(job.id);
                            if (res.success && res.agentName) {
                              setAssignmentNotice(`Job assigned to ${res.agentName} (Model is now Active!)`);
                              setTimeout(() => setAssignmentNotice(null), 3000);
                            }
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-[11px] transition-colors"
                          title="Assign to the best matching idle agent"
                        >
                          <Zap className="w-3 h-3 fill-white" />
                          <span>Auto-Assign to Idle Agent</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Manual Quick Reassign Dropdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-neutral-500 hidden sm:inline">Assign to:</span>
                    <select
                      onChange={e => {
                        const val = e.target.value;
                        if (!val) return;
                        if (val.startsWith('agent:')) {
                          handleQuickAssignAgent(job.id, val.replace('agent:', ''));
                        } else if (val.startsWith('user:')) {
                          const user = teamMembers.find(u => u.id === val.replace('user:', ''));
                          if (user) assignJob(job.id, 'user', user.id, user.name);
                        }
                        e.target.value = '';
                      }}
                      defaultValue=""
                      className="px-2.5 py-1 rounded-lg bg-[#202125] border border-[#2E3035] text-white text-[11px] focus:outline-none focus:border-orange-500 font-sans cursor-pointer"
                    >
                      <option value="" disabled>Change Assignee...</option>
                      <optgroup label="Connected Models (Awakens Idle)">
                        {agents.map(a => (
                          <option key={a.id} value={`agent:${a.id}`}>
                            🤖 {a.name} [{a.status}]
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Team Members">
                        {teamMembers.map(u => (
                          <option key={u.id} value={`user:${u.id}`}>
                            👤 {u.name} ({u.role})
                          </option>
                        ))}
                      </optgroup>
                    </select>

                    <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-400 ml-2">
                      <Database className="w-3 h-3 text-neutral-500" />
                      <span>{job.estimatedTokens} tokens</span>
                    </div>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      <CreateJobModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      <JobDetailsModal />

    </div>
  );
}
