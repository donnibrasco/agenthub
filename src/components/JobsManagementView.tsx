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
    <div className="min-w-0 space-y-6">
      {/* ─── Top Header Banner ─── */}
      <div className="rounded-3xl bg-[#fffdfa] border border-[#e7e2d9] p-6 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#e9f2eb] text-[#08666c] border border-[#166b66]/25">
                <Briefcase className="w-4 h-4" />
              </span>
              <h1 className="text-3xl font-semibold tracking-tight text-[#282820] sm:text-4xl">
                Jobs & Tasks
              </h1>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm text-[#665f54] sm:text-base">
              Queue work, assign it to a connected agent or teammate, and track progress.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleAutoAssignAll}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#08666c] hover:bg-[#0a7a80] text-white font-semibold text-xs tracking-wide transition-colors shadow-md"
              title="Automatically match all queued jobs with available idle connected models"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Auto-assign queued jobs</span>
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#262922] hover:bg-[#3b4236] text-white font-semibold text-xs tracking-wide transition-colors shadow-md"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create Job</span>
            </button>
          </div>
        </div>

        {/* Live Notification Bar */}
        {assignmentNotice && (
          <div className="p-3 rounded-xl bg-[#e9f2eb] border border-[#166b66]/25 text-[#1f6b5f] text-sm flex items-center justify-between animate-in fade-in duration-200" role="status">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#1f6b5f]" />
              <span>{assignmentNotice}</span>
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => setAssignmentNotice(null)} className="rounded p-1 text-[#665f54] hover:bg-[#dfece4] hover:text-[#282820]">✕</button>
          </div>
        )}

        {/* ─── Fleet Utilization & Workload Stats ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#e7e2d9]">
          <div className="p-3 rounded-2xl bg-[#fffdfa] border border-[#e7e2d9]">
            <div className="text-xs text-[#665f54] font-medium">Total Jobs</div>
            <div className="text-xl font-semibold text-[#282820] mt-1">{jobs.length}</div>
            <div className="text-xs text-[#777064] mt-0.5">Centralized queue</div>
          </div>

          <div className="p-3 rounded-2xl bg-[#fffdfa] border border-[#e7e2d9]">
            <div className="text-xs text-[#665f54] font-medium">In Progress</div>
            <div className="text-xl font-semibold text-[#1f6b5f] mt-1">
              {jobs.filter(j => j.status === 'in_progress').length}
            </div>
            <div className="text-xs text-[#777064] mt-0.5">Active execution</div>
          </div>

          <div className="p-3 rounded-2xl bg-[#fffdfa] border border-[#e7e2d9]">
            <div className="text-xs text-[#665f54] font-medium">Idle Agents Ready</div>
            <div className="text-xl font-semibold text-[#8a6418] mt-1">
              {fleetStats.idleCount}
            </div>
            <div className="text-xs text-[#777064] mt-0.5">Available to assign</div>
          </div>

          <div className="p-3 rounded-2xl bg-[#fffdfa] border border-[#e7e2d9]">
            <div className="flex items-center justify-between text-xs text-[#665f54] font-medium">
              <span>Fleet Utilization</span>
              <span className="text-[#282820] font-semibold">{fleetStats.utilizationRate}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#f2eee6] overflow-hidden mt-2">
              <div 
                className="h-full bg-[#08666c] transition-all duration-500"
                style={{ width: `${fleetStats.utilizationRate}%` }}
              />
            </div>
            <div className="text-xs text-[#777064] mt-1">
              {fleetStats.activeCount} of {fleetStats.total} agents active
            </div>
          </div>
        </div>
      </div>

      {/* ─── Search and Filters Bar ─── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#777064] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search jobs by title, payload or assignee..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#fffdfa] border border-[#e7e2d9] text-xs text-[#282820] placeholder-[#777064] focus:outline-none focus:border-[#08666c] font-sans"
          />
        </div>

        {/* Status Filters */}
        <div className="-mx-1 flex min-w-0 items-center gap-1.5 overflow-x-auto px-1 pb-1 md:pb-0 font-medium text-xs">
          {[
            { id: 'all', label: 'All jobs' },
            { id: 'queued', label: 'Needs assignee' },
            { id: 'in_progress', label: 'In progress' },
            { id: 'agent', label: 'Assigned to agents' },
            { id: 'user', label: 'Assigned to people' },
            { id: 'completed', label: 'Completed' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                filterStatus === tab.id
                  ? 'bg-[#08666c] text-white font-semibold shadow-sm'
                  : 'bg-[#fffdfa] text-[#665f54] hover:text-[#282820] border border-[#e7e2d9]'
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
          <div className="p-12 text-center rounded-2xl bg-[#fffdfa] border border-[#e7e2d9] space-y-3">
            <Briefcase className="w-10 h-10 text-[#777064] mx-auto" />
            <p className="text-sm font-semibold text-[#4b4941]">No jobs match your search or filter.</p>
            <button
              onClick={() => { setSearchQuery(''); setFilterStatus('all'); }}
              className="text-xs text-[#08666c] hover:underline"
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
                className="group relative min-w-0 p-4 sm:p-5 rounded-2xl bg-[#fffdfa] border border-[#e7e2d9] hover:border-[#d8d3ca] transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Priority Flair */}
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        job.priority === 'critical' ? 'bg-[#f9ece4] text-[#922d1d] border border-[#a44e32]/25' :
                        job.priority === 'high' ? 'bg-[#f7eed7] text-[#8a6418] border border-[#987529]/25' :
                        job.priority === 'medium' ? 'bg-[#e8eef6] text-[#2f5d8a] border border-[#2f5d8a]/25' :
                        'bg-[#ede9e0] text-[#665f54] border border-[#d8d3ca]'
                      }`}>
                        {job.priority}
                      </span>

                      {/* Status */}
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        job.status === 'in_progress' ? 'bg-[#e9f2eb] text-[#1f6b5f] border border-[#166b66]/25' :
                        job.status === 'failed' ? 'bg-[#f9ece4] text-[#922d1d] border border-[#a44e32]/25' :
                        job.status === 'paused' ? 'bg-[#f7eed7] text-[#6d551d] border border-[#987529]/25' :
                        job.status === 'queued' ? 'bg-[#f7eed7] text-[#8a6418] border border-[#987529]/25' :
                        job.status === 'completed' ? 'bg-[#e8eef6] text-[#2f5d8a] border border-[#2f5d8a]/25' :
                        'bg-[#ede9e0] text-[#665f54] border border-[#d8d3ca]'
                      }`}>
                        {job.status.replace('_', ' ')}
                      </span>

                      {/* Category */}
                      <span className="px-2.5 py-0.5 rounded-full text-xs bg-[#f2eee6] text-[#4b4941] border border-[#d8d3ca]">
                        {job.category}
                      </span>

                      <span className="text-xs text-[#777064]">
                        Due {job.deadline || 'ASAP'}
                      </span>
                    </div>

                    <h3 className="break-words text-base font-semibold text-[#282820]">
                      {job.title}
                    </h3>
                  </div>

                  {/* Right Action: Inspect Details */}
                  <button
                    onClick={() => setActiveJobDetails(job)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f2eee6] hover:bg-[#ede9e0] text-[#282820] text-xs font-semibold transition-colors self-start sm:self-auto shrink-0"
                  >
                    <span>View Details</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#665f54]" />
                  </button>
                </div>

                <p className="text-sm text-[#665f54] leading-relaxed line-clamp-2 break-words">
                  {job.description}
                </p>

                {/* Assignment & Execution Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#e7e2d9] text-xs">
                  
                  {/* Assignee Box */}
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-xs text-[#777064]">Assignee</span>

                    {job.assignedType === 'agent' ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#e9f2eb] border border-[#166b66]/25 text-[#08666c] font-medium">
                        <Bot className="w-3.5 h-3.5 text-[#08666c]" />
                        <span>{job.assignedToName}</span>
                        
                      </div>
                    ) : job.assignedType === 'user' ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#e8eef6] border border-[#2f5d8a]/25 text-[#2f5d8a] font-medium">
                        <User className="w-3.5 h-3.5 text-[#2f5d8a]" />
                        <span>{job.assignedToName}</span>
                        <span className="text-xs text-[#665f54]">· {job.assignedToRole || 'User'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs bg-[#f7eed7] border border-[#987529]/25 text-[#6d551d]">
                          Unassigned
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
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#08666c] hover:bg-[#0a7a80] text-white font-semibold text-xs transition-colors"
                          title="Assign to the best matching idle agent"
                        >
                          <Zap className="w-3 h-3 fill-white" />
                          <span>Auto-assign</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Manual Quick Reassign Dropdown */}
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <label htmlFor={`assign-${job.id}`} className="sr-only">Change assignee for {job.title}</label>
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
                      id={`assign-${job.id}`}
                      defaultValue=""
                      className="min-w-0 max-w-full px-2.5 py-1 rounded-lg bg-[#f2eee6] border border-[#d8d3ca] text-[#282820] text-xs focus:outline-none focus:border-[#08666c] font-sans cursor-pointer"
                    >
                      <option value="" disabled>Change assignee…</option>
                      <optgroup label="Connected agents">
                        {agents.map(a => (
                          <option key={a.id} value={`agent:${a.id}`}>
                            {a.name} ({a.status})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Team Members">
                        {teamMembers.map(u => (
                          <option key={u.id} value={`user:${u.id}`}>
                            {u.name} ({u.role})
                          </option>
                        ))}
                      </optgroup>
                    </select>

                    <div className="flex items-center gap-1 whitespace-nowrap text-xs text-[#665f54]">
                      <Database className="w-3 h-3 text-[#777064]" />
                      <span className="tabular-nums">{job.estimatedTokens.toLocaleString()} tokens</span>
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
