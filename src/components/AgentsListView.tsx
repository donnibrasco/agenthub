import React, { useState, useEffect, useRef } from 'react';
import { useNeuro, NeuroAgent } from '../context/NeuroContext';
import { sortAgentsByRedditRule, AgentSortMode } from '../lib/agentSorting';
import { 
  Bot, 
  ArrowRight, 
  Database, 
  Plus, 
  Search, 
  Power,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  MessageSquare,
  Share2,
  Bookmark,
  Check,
  Copy,
  Terminal,
  ShieldCheck,
  Cpu,
  Flame,
  Sparkles,
  Award,
  Layers,
  Clock,
  Radio,
  Zap,
  Briefcase,
  Loader2,
  Plug,
  Settings2,
  Activity
} from 'lucide-react';

export function AgentsListView() {
  const { 
    agents, 
    jobs,
    searchQuery: globalSearchQuery,
    setActiveLaunchAgent, 
    toggleAgentStatus, 
    voteAgent,
    assignJob,
    setActiveTab,
    setIsConnectModalOpen,
    setEditingModel,
    pingConnectedModel,
    deployInfo
  } = useNeuro();

  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortMode, setSortMode] = useState<AgentSortMode>('active_first');
  const [copiedAgentId, setCopiedAgentId] = useState<string | null>(null);
  const [copiedHook, setCopiedHook] = useState<boolean>(false);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Infinite Scroll state (no pages)
  const [visibleCount, setVisibleCount] = useState<number>(6);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const categories = ['All', 'Engineering', 'Communication', 'Design', 'Search'];
  const effectiveSearch = (searchQuery || globalSearchQuery).trim().toLowerCase();

  // Filter agents by category and search
  const filtered = agents.filter(a => {
    const matchesCategory = filterCategory === 'All' || a.category === filterCategory;
    const matchesSearch = !effectiveSearch || 
      a.name.toLowerCase().includes(effectiveSearch) ||
      a.description.toLowerCase().includes(effectiveSearch) ||
      a.model.toLowerCase().includes(effectiveSearch);
    return matchesCategory && matchesSearch;
  });

  // Sort based on current Reddit sort mode (default: active_first: newest active on top, inactives at bottom)
  const sortedAgents = sortAgentsByRedditRule(filtered, sortMode);

  // Group into active and inactive when in 'active_first' mode
  const activeGroup = sortedAgents.filter(a => a.status === 'Active');
  const inactiveGroup = sortedAgents.filter(a => a.status !== 'Active');

  // Infinite scroll items slice
  const displayedActive = activeGroup.slice(0, visibleCount);
  const displayedInactive = inactiveGroup.slice(0, Math.max(0, visibleCount - activeGroup.length));

  // Infinite Scroll observer (automatically loads more as user scrolls down)
  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && visibleCount < sortedAgents.length && !isLoadingMore) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setVisibleCount(prev => prev + 4);
            setIsLoadingMore(false);
          }, 350);
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [visibleCount, sortedAgents.length, isLoadingMore]);

  const copyCurl = (agent: NeuroAgent) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-hetzner-domain.com';
    const snippet = `curl -X POST "${origin}/api/models/${agent.id}/run" \\\n  -H "Content-Type: application/json" \\\n  -d '{"prompt": "Audit codebase drift and report invariants"}'`;
    navigator.clipboard?.writeText(snippet);
    setCopiedAgentId(agent.id);
    setTimeout(() => setCopiedAgentId(null), 2000);
  };

  const handleAssignJobToAgent = (agent: NeuroAgent) => {
    const pendingJob = jobs.find(j => j.status === 'queued' || j.assignedType === 'unassigned');
    if (pendingJob) {
      assignJob(pendingJob.id, 'agent', agent.id, agent.name);
      setActionNotice(`Dispatched pending job "${pendingJob.title}" to ${agent.name}. Model is now ACTIVE!`);
    } else {
      toggleAgentStatus(agent.id);
      setActionNotice(`${agent.name} is now ACTIVE! Head over to Jobs tab to assign tasks.`);
    }
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handlePingModel = async (agent: NeuroAgent) => {
    setActionNotice(`Probing ${agent.domain || agent.endpointUrl || agent.name} from server...`);
    const probe = await pingConnectedModel(agent.id);
    if (probe.reachable) {
      setActionNotice(`Ping OK · ${agent.name} (${agent.domain}) · ${probe.message} (${probe.latencyMs}ms).`);
    } else {
      setActionNotice(`Ping Unreachable · ${agent.name} (${agent.domain}) · ${probe.message}.`);
    }
    setTimeout(() => setActionNotice(null), 4500);
  };

  const copyTelemetryHook = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-hetzner-domain.com';
    const cmd = `curl -X POST "${origin}${deployInfo.telemetryPath}" \\\n  -H "Authorization: Bearer ${deployInfo.ingestKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"agentName":"My-Agent","repository":"org/repo","type":"steering","message":"Verify tests before PR","tokensUsed":120,"latencyMs":42}'`;
    navigator.clipboard?.writeText(cmd);
    setCopiedHook(true);
    setTimeout(() => setCopiedHook(false), 2500);
  };

  const openConnectModal = () => {
    setEditingModel(null);
    setIsConnectModalOpen(true);
  };

  const openManageModal = (agent: NeuroAgent) => {
    setEditingModel(agent);
    setIsConnectModalOpen(true);
  };

  const renderAgentRow = (agent: NeuroAgent, rankIndex: number) => {
    const isActive = agent.status === 'Active';
    const isCopied = copiedAgentId === agent.id;
    const isExpanded = expandedAgentId === agent.id;

    // Split date for stack formatting
    const dateParts = agent.date.split(',');
    const dateDay = dateParts[0]?.trim() || agent.date;
    const dateTime = dateParts.length > 1 ? dateParts.slice(1).join(',').trim() : '';

    return (
      <div 
        key={agent.id}
        className={`group relative flex items-start gap-2.5 sm:gap-3.5 p-3 sm:p-4 rounded-xl transition-all border ${
          isActive 
            ? 'bg-[#18191B] hover:bg-[#1E1F23] border-[#2A2B2F]' 
            : 'bg-[#151618]/90 hover:bg-[#1A1B1D] border-[#232427] opacity-85 hover:opacity-100'
        }`}
      >
        {/* 1. Left Rank Number */}
        <div className="w-5 sm:w-7 pt-1 text-right shrink-0 select-none">
          <span className="font-mono text-xs sm:text-sm font-bold text-neutral-500 group-hover:text-neutral-300 transition-colors">
            {rankIndex + 1}
          </span>
        </div>

        {/* 2. Reddit Vote Controls WITH DATE PLACED DIRECTLY UNDER THE VOTE NUMBER */}
        <div className="flex flex-col items-center justify-start shrink-0 pt-0.5 select-none bg-[#111214] border border-[#27282C] rounded-lg px-2 py-1.5 min-w-[62px] text-center">
          <button
            onClick={() => voteAgent(agent.id, 'up')}
            className={`p-1 rounded hover:bg-[#25262B] transition-colors ${
              agent.userVote === 'up' ? 'text-[#FF4500]' : 'text-neutral-400 hover:text-[#FF4500]'
            }`}
            title="Upvote agent (promote in fleet)"
            aria-label="Upvote"
          >
            <ChevronUp className="w-4 h-4 stroke-[2.5]" />
          </button>
          
          <span className={`font-mono text-xs font-bold leading-tight my-0.5 ${
            agent.userVote === 'up' 
              ? 'text-[#FF4500]' 
              : agent.userVote === 'down' 
              ? 'text-[#7193FF]' 
              : 'text-neutral-300'
          }`}>
            {agent.score ?? agent.tokens}
          </span>

          <button
            onClick={() => voteAgent(agent.id, 'down')}
            className={`p-1 rounded hover:bg-[#25262B] transition-colors ${
              agent.userVote === 'down' ? 'text-[#7193FF]' : 'text-neutral-400 hover:text-[#7193FF]'
            }`}
            title="Downvote agent"
            aria-label="Downvote"
          >
            <ChevronDown className="w-4 h-4 stroke-[2.5]" />
          </button>

          {/* User Requested: Date place directly under the vote number */}
          <div className="pt-1.5 mt-1 border-t border-[#232427] w-full flex flex-col items-center text-center">
            <span className="font-mono text-[10px] font-bold text-neutral-300 leading-tight block truncate max-w-[58px]" title={agent.date}>
              {dateDay}
            </span>
            {dateTime && (
              <span className="font-mono text-[9px] text-neutral-400 leading-tight block mt-0.5 truncate max-w-[58px]">
                {dateTime.split(' ')[0]} {dateTime.split(' ')[1] || ''}
              </span>
            )}
          </div>
        </div>

        {/* 3. Post Thumbnail / Model Avatar Square */}
        <div className="relative shrink-0 hidden xs:flex">
          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center border transition-all ${
            isActive 
              ? 'bg-[#222428] border-emerald-500/30 text-white shadow-sm' 
              : 'bg-[#1B1C1E] border-neutral-700/50 text-neutral-500'
          }`}>
            <Bot className={`w-6 h-6 ${isActive ? 'text-emerald-400' : 'text-neutral-500'}`} />
          </div>

          {/* Pulse Status Indicator */}
          <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#18191B] flex items-center justify-center ${
            isActive ? 'bg-emerald-500' : 'bg-neutral-600'
          }`}>
            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping opacity-75" />}
          </span>
        </div>

        {/* 4. Entry Details & Reddit Byline */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Title line + Domain */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <button
              onClick={() => setActiveLaunchAgent(agent)}
              className="text-left font-bold text-sm sm:text-base text-white hover:text-blue-400 transition-colors tracking-tight line-clamp-1"
            >
              {agent.name}
            </button>

            {/* Domain host (old.reddit style) */}
            <span className="text-[11px] font-mono text-neutral-400 hover:text-neutral-300">
              ({agent.domain || 'creativeprocess.io'})
            </span>

            {/* Flair 1: Status */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider ${
              isActive 
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' 
                : 'bg-neutral-800/80 text-neutral-400 border border-neutral-700/60'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'}`} />
              {agent.status}
            </span>

            {/* Flair 2: Model */}
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[#23252A] text-blue-300 border border-[#30333A]">
              {agent.model}
            </span>

            {/* Flair 3: Runtime */}
            {agent.runtime && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[#1C2329] text-cyan-300 border border-[#293540]">
                {agent.runtime}
              </span>
            )}

            {/* Flair 4: Category */}
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#242528] text-neutral-300 border border-[#34363C]">
              {agent.category}
            </span>
          </div>

          {/* Submission Byline (old.reddit standard - date is anchored on the left stack) */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-400 leading-normal">
            <span>connected by</span>
            <span className="text-blue-400 font-medium">
              {agent.author || 'u/franklin_dev'}
            </span>
            <span>to</span>
            <span className="text-neutral-300 font-medium">
              {agent.subreddit || `r/${agent.category.toLowerCase()}`}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1 font-mono text-[11px] text-neutral-400">
              <Database className="w-3 h-3 text-neutral-500" />
              {agent.tokens} tokens
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400/90 font-mono">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              {agent.e2eeFingerprint || 'E2E encrypted'}
            </span>
          </div>

          {/* Description Snippet */}
          <p className={`text-xs text-neutral-400 leading-relaxed font-sans ${isExpanded ? '' : 'line-clamp-2'}`}>
            {agent.description}
          </p>

          {/* Reddit Action Links Bar */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 text-[11px] font-semibold text-neutral-400">
            {/* Run / Test Prompt */}
            <button
              onClick={() => setActiveLaunchAgent(agent)}
              className="flex items-center gap-1 text-white hover:text-blue-400 hover:underline py-0.5 transition-colors"
            >
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span>[ run prompt ]</span>
            </button>

            {/* Manage Endpoint Connection */}
            <button
              onClick={() => openManageModal(agent)}
              className="flex items-center gap-1 text-neutral-200 hover:text-emerald-400 hover:underline py-0.5 transition-colors"
              title="Edit endpoint URL, provider, or disconnect model"
            >
              <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>[ manage connection ]</span>
            </button>

            {/* Ping Endpoint Latency */}
            <button
              onClick={() => handlePingModel(agent)}
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 hover:underline py-0.5 transition-colors font-mono"
              title="Verify endpoint reachability and refresh latency"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>[ ping {agent.latencyMs ?? 32}ms ]</span>
            </button>

            {/* Status Switch (Active / Idle) */}
            <button
              onClick={() => toggleAgentStatus(agent.id)}
              className={`flex items-center gap-1 hover:underline py-0.5 transition-colors ${
                isActive ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'
              }`}
              title={isActive ? 'Set idle and send to bottom' : 'Activate and promote to top'}
            >
              <Power className="w-3.5 h-3.5" />
              <span>[ {isActive ? 'set idle (to bot)' : 'activate (to top)'} ]</span>
            </button>

            {/* Quick Assign Pending Job (to prevent connected model from sitting idle!) */}
            {!isActive && (
              <button
                onClick={() => handleAssignJobToAgent(agent)}
                className="flex items-center gap-1 text-orange-400 hover:text-orange-300 hover:underline py-0.5 transition-colors"
                title="Assign an unassigned or queued job to awaken this connected model"
              >
                <Zap className="w-3.5 h-3.5 fill-orange-400" />
                <span>[ assign pending job ]</span>
              </button>
            )}

            {/* Copy cURL */}
            <button
              onClick={() => copyCurl(agent)}
              className="flex items-center gap-1 hover:text-neutral-200 hover:underline py-0.5 transition-colors"
            >
              {isCopied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 font-mono">copied cURL!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>share cURL</span>
                </>
              )}
            </button>

            {/* Toggle Full Description */}
            <button
              onClick={() => setExpandedAgentId(isExpanded ? null : agent.id)}
              className="hover:text-neutral-200 hover:underline py-0.5 transition-colors"
            >
              {isExpanded ? 'less' : 'details'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      
      {/* ─── Community Subreddit Header (old.reddit style) ─── */}
      <div className="rounded-2xl bg-[#18191B] border border-[#27282C] p-4 sm:p-5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#25262A]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-md font-bold text-lg select-none">
              r/
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight font-sans">
                  r/connected_models
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#28292E] text-neutral-300 border border-[#35373E]">
                  Infinite Stream
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-sans mt-0.5">
                Connect and manage your created models across local, self-hosted, and cloud endpoints. Newest actives on top; dormant models at bottom.
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('jobs')}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#242529] hover:bg-[#2E3036] text-orange-400 font-bold text-xs tracking-wide transition-colors border border-orange-500/30 shrink-0"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Manage Jobs & Tasks</span>
            </button>

            <button
              onClick={openConnectModal}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wide transition-colors shadow-sm shrink-0"
            >
              <Plug className="w-4 h-4 stroke-[2.2]" />
              <span>Connect Model</span>
            </button>
          </div>
        </div>

        {/* Live Action Notice Bar */}
        {actionNotice && (
          <div className="p-3 rounded-xl bg-orange-950/60 border border-orange-800/80 text-orange-300 text-xs flex items-center justify-between animate-in fade-in duration-200 font-mono">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-400 fill-orange-400" />
              <span>{actionNotice}</span>
            </div>
            <button onClick={() => setActionNotice(null)} className="text-neutral-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Old Reddit Sub-Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 font-medium">
            <button
              onClick={() => setSortMode('active_first')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                sortMode === 'active_first'
                  ? 'bg-orange-600 text-white font-bold shadow-sm'
                  : 'bg-[#212226] text-neutral-400 hover:text-white hover:bg-[#28292E]'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>active first (newest top)</span>
            </button>

            <button
              onClick={() => setSortMode('newest')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                sortMode === 'newest'
                  ? 'bg-white text-neutral-950 font-bold shadow-sm'
                  : 'bg-[#212226] text-neutral-400 hover:text-white hover:bg-[#28292E]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>all newest</span>
            </button>

            <button
              onClick={() => setSortMode('top_score')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                sortMode === 'top_score'
                  ? 'bg-white text-neutral-950 font-bold shadow-sm'
                  : 'bg-[#212226] text-neutral-400 hover:text-white hover:bg-[#28292E]'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>top karma</span>
            </button>

            <button
              onClick={() => setSortMode('top_tokens')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                sortMode === 'top_tokens'
                  ? 'bg-white text-neutral-950 font-bold shadow-sm'
                  : 'bg-[#212226] text-neutral-400 hover:text-white hover:bg-[#28292E]'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>most tokens</span>
            </button>

            <button
              onClick={() => setSortMode('inactive_first')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                sortMode === 'inactive_first'
                  ? 'bg-white text-neutral-950 font-bold shadow-sm'
                  : 'bg-[#212226] text-neutral-400 hover:text-white hover:bg-[#28292E]'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>inactives first</span>
            </button>
          </div>

          {/* Quick Fleet Counter Badge */}
          <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400 bg-[#121315] px-2.5 py-1 rounded-lg border border-[#27282C]">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {activeGroup.length} Online
            </span>
            <span className="text-neutral-600">|</span>
            <span className="text-neutral-400">
              {inactiveGroup.length} Dormant (at bot)
            </span>
          </div>
        </div>
      </div>

      {/* ─── Search and Category Filter Toolbar ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search connected models by name, model ID, or endpoint..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#18191B] border border-[#2A2B2F] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-400 font-sans"
          />
        </div>

        {/* Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-mono text-neutral-500 mr-1 hidden sm:inline">filter:</span>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                filterCategory === cat
                  ? 'bg-neutral-200 text-neutral-900 font-bold shadow-sm'
                  : 'bg-[#18191B] text-neutral-400 hover:text-white border border-[#2A2B2F]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Main Content Layout with Reddit Sidebar ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column: Post Feed (col 1-8/9) with Infinite Scroll */}
        <div className="lg:col-span-8 space-y-3">
          
          {sortedAgents.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[#18191B] border border-[#27282C] space-y-3">
              <Bot className="w-10 h-10 text-neutral-500 mx-auto" />
              <p className="text-sm font-semibold text-neutral-300">No agents found matching "{searchQuery}"</p>
              <button
                onClick={() => { setSearchQuery(''); setFilterCategory('All'); }}
                className="text-xs text-blue-400 hover:underline"
              >
                Clear search and filters
              </button>
            </div>
          ) : sortMode === 'active_first' ? (
            /* Partitioned View: Actives on Top (Newest First), Inactives on Bottom (Newest First) */
            <>
              {/* Section 1: Active Connected Models (Newest First) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 py-1 text-xs">
                  <div className="flex items-center gap-2 font-mono font-bold text-emerald-400 uppercase tracking-wider text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Active Models · Newest on Top ({activeGroup.length})</span>
                  </div>
                  <span className="text-[11px] text-neutral-500 font-mono">
                    Date anchored under vote number
                  </span>
                </div>

                <div className="space-y-2">
                  {displayedActive.map((agent, idx) => renderAgentRow(agent, idx))}
                </div>
              </div>

              {/* Section 2: Inactive / Idle Connected Models Separator & Bottom List */}
              {inactiveGroup.length > 0 && (
                <div className="space-y-2 pt-4">
                  <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#141517] border border-[#232427]">
                    <div className="flex items-center gap-2 font-mono font-bold text-neutral-400 uppercase tracking-wider text-[11px]">
                      <Power className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Inactive / Standby Models · Bottom of Feed ({inactiveGroup.length})</span>
                    </div>
                    <span className="text-[10px] text-orange-400 font-mono">
                      Assign jobs to awaken idle models
                    </span>
                  </div>

                  <div className="space-y-2">
                    {displayedInactive.map((agent, idx) => renderAgentRow(agent, activeGroup.length + idx))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Standard Sorted List (e.g. all newest, top karma, etc.) */
            <div className="space-y-2">
              {sortedAgents.slice(0, visibleCount).map((agent, idx) => renderAgentRow(agent, idx))}
            </div>
          )}

          {/* ─── Infinite Scroll Sentinel & Stream Trigger ─── */}
          <div ref={sentinelRef} className="pt-4 pb-2">
            {visibleCount < sortedAgents.length ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 p-3 rounded-xl bg-[#141517] border border-[#222326] text-xs font-mono text-neutral-400">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                  <span>Continuous stream active · Scroll down to load more</span>
                </div>
                <button
                  onClick={() => setVisibleCount(prev => prev + 4)}
                  className="px-3 py-1 rounded-lg bg-[#202125] hover:bg-[#28292E] text-white text-[11px] font-semibold transition-colors"
                >
                  Load Next Batch Now
                </button>
              </div>
            ) : (
              <div className="p-3 text-center text-xs font-mono text-neutral-500 border-t border-[#232427]">
                ✓ Infinite feed stream synchronized — all {sortedAgents.length} agents rendered without pagination.
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Reddit Subreddit Sidebar (col 9-12) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Subreddit About Card */}
          <div className="rounded-2xl bg-[#18191B] border border-[#27282C] p-4 space-y-3.5">
            <div className="pb-3 border-b border-[#26272B]">
              <h2 className="text-xs font-bold text-neutral-300 font-mono uppercase tracking-wider">
                About Connected Fleet
              </h2>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Welcome to <span className="text-white font-medium">r/connected_models</span>. Connect and manage your already-created models across local workstations, vLLM clusters, and cloud APIs.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 py-1 font-mono text-center">
              <div className="p-2 rounded-xl bg-[#131416] border border-[#242528]">
                <div className="text-base font-bold text-white">{agents.length}</div>
                <div className="text-[10px] text-neutral-500 uppercase">Connected Models</div>
              </div>
              <div className="p-2 rounded-xl bg-[#131416] border border-[#242528]">
                <div className="text-base font-bold text-emerald-400">{activeGroup.length}</div>
                <div className="text-[10px] text-neutral-500 uppercase">Active Now</div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={openConnectModal}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wide transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <Plug className="w-4 h-4" />
                <span>Connect Existing Model</span>
              </button>

              <button
                onClick={() => setActiveTab('jobs')}
                className="w-full py-2 rounded-xl bg-[#242529] hover:bg-[#2C2E33] text-orange-400 font-semibold text-xs transition-colors flex items-center justify-center gap-2 border border-orange-500/30"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Manage Fleet Jobs & Tasks</span>
              </button>
            </div>

            {/* Posting & Fleet Guidelines */}
            <div className="pt-2 border-t border-[#26272B] space-y-2">
              <h3 className="text-[11px] font-bold text-neutral-300 uppercase font-mono">
                Fleet Invariants
              </h3>
              <ol className="text-xs text-neutral-400 space-y-1.5 list-decimal pl-4">
                <li><span className="text-neutral-300">Infinite Stream</span>: Continuous scrolling with zero pagination breaks.</li>
                <li><span className="text-neutral-300">Date Under Vote</span>: Exact timestamp anchored under the karma stack.</li>
                <li><span className="text-neutral-300">Zero Idle Downtime</span>: Dispatch queued jobs to awaken idle agents.</li>
                <li><span className="text-neutral-300">Active Priority</span>: Active agents auto-sort to the top by date.</li>
              </ol>
            </div>

            {/* Moderators List */}
            <div className="pt-2 border-t border-[#26272B] space-y-1.5">
              <h3 className="text-[11px] font-bold text-neutral-300 uppercase font-mono">
                Maintainers
              </h3>
              <div className="text-xs text-blue-400 space-y-1 font-mono">
                <div>u/franklin_eugene (Lead)</div>
                <div>u/creativeprocess_ops</div>
              </div>
            </div>
          </div>

          {/* Agent Telemetry Webhook Card for Hetzner VPS */}
          <div className="rounded-2xl bg-[#141517] border border-[#232427] p-3.5 text-xs text-neutral-400 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-neutral-200 font-semibold font-mono text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Agent Telemetry Webhook</span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 font-mono text-[10px]">
                SQLite
              </span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Push heartbeats, token usage, and friction signals from any external agent straight to <code className="text-neutral-200">{deployInfo.telemetryPath}</code>.
            </p>
            {deployInfo.ingestKey && (
              <div className="p-2 rounded-lg bg-[#0F1012] border border-[#222428] font-mono text-[10px] text-neutral-300 truncate select-all">
                Bearer {deployInfo.ingestKey}
              </div>
            )}
            <button
              type="button"
              onClick={copyTelemetryHook}
              className="w-full py-1.5 px-3 rounded-lg bg-[#202126] hover:bg-[#292B31] border border-[#2E3038] text-neutral-200 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
            >
              {copiedHook ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied Agent Webhook cURL</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Agent Telemetry cURL</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Help Card */}
          <div className="rounded-2xl bg-[#141517] border border-[#232427] p-3.5 text-xs text-neutral-400 space-y-2">
            <div className="flex items-center gap-2 text-neutral-200 font-semibold font-mono text-[11px]">
              <Zap className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
              <span>Preventing Inactive Models</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Click <span className="text-orange-400 font-semibold">[assign pending job]</span> on any dormant model at the bottom to match it with an open job and promote it to the active top fleet.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
