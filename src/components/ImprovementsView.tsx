import React, { useState, useMemo } from 'react';
import { useNeuro } from '../context/NeuroContext';
import {
  computeSignalRates,
  summarizeImprovementMetrics,
  buildChartPolylinePoints,
  ImprovementProposal,
} from '../lib/improvementsEngine';
import {
  Search,
  ChevronRight,
  Info,
  RotateCcw,
  Compass,
  Flame,
  Check,
  X,
  ScanSearch,
  GitFork,
  MessageSquarePlus,
  CheckCircle2,
  FileCode2,
  Sparkles,
} from 'lucide-react';

interface GaugeProps {
  label: string;
  pct: number;
  icon: React.ReactNode;
  accentBorderClass: string;
  comparisonText: string;
}

function SignalArcGauge({
  label,
  pct,
  icon,
  accentBorderClass,
  comparisonText,
}: GaugeProps) {
  // Semi-circular arc from (18, 90) to (162, 90) with radius 72 -> circumference = PI * 72 ~= 226.19
  const radius = 72;
  const arcLength = Math.PI * radius;
  // Scale: cap gauge visual fill at 5% so 0.5-2.5% rates are clearly proportional and crisp
  const normalizedRatio = Math.max(0, Math.min(pct / 5, 1));
  const filledDash = normalizedRatio * arcLength;
  const gradId = `gauge-grad-${label.toLowerCase()}`;

  return (
    <div className={`flex flex-col pb-4 border-b-2 ${accentBorderClass}`}>
      <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-medium mb-3">
        <span className="text-neutral-400">{icon}</span>
        <span>{label}</span>
      </div>

      <div className="relative flex flex-col items-center justify-center py-1">
        <svg
          viewBox="0 0 180 105"
          className="w-44 h-26 overflow-visible"
          aria-label={`${label} signal rate ${pct.toFixed(1)}%`}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#3B8C66" />
              <stop offset="52%" stopColor="#C9A243" />
              <stop offset="100%" stopColor="#C85348" />
            </linearGradient>
          </defs>

          {/* Background gradient track */}
          <path
            d="M 18 90 A 72 72 0 0 1 162 90"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="12"
            strokeLinecap="round"
            opacity={pct > 0 ? 0.25 : 0.88}
          />

          {/* Active fill arc when rate > 0 */}
          {pct > 0 && (
            <path
              d="M 18 90 A 72 72 0 0 1 162 90"
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${filledDash.toFixed(1)} ${arcLength.toFixed(1)}`}
            />
          )}
        </svg>

        <div className="-mt-9 text-center">
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            {pct.toFixed(1)}%
          </div>
          <div className="text-[11px] text-neutral-500 mt-1 flex items-center justify-center gap-1">
            <span>{comparisonText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowerMarkIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 12C12 9 14.2 6.5 16.5 8C18.5 9.3 16.2 12 12 12ZM12 12C12 9 9.8 6.5 7.5 8C5.5 9.3 7.8 12 12 12ZM12 12C9.5 13 8.5 16.2 10.7 17.3C12.7 18.2 13 15 12 12ZM12 12C14.5 13 15.5 16.2 13.3 17.3C11.3 18.2 11 15 12 12Z"
        fill="currentColor"
      />
      <path d="M12 16.5V21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ImprovementsView() {
  const {
    frictionSignals,
    signalClusters,
    improvementProposals,
    totalAnalyzedMessages,
    dailySignalSeries,
    resolveImprovement,
    scanModelsForFriction,
    resetImprovementsBaseline,
    submitImproveFeedback,
  } = useNeuro();

  const [proposalFilter, setProposalFilter] = useState<'pending' | 'applied' | 'all'>('pending');
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(
    improvementProposals.find(p => p.status === 'pending')?.id || null
  );
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const summary = useMemo(
    () => summarizeImprovementMetrics(frictionSignals, signalClusters, improvementProposals),
    [frictionSignals, signalClusters, improvementProposals]
  );

  const rates = useMemo(
    () => computeSignalRates(frictionSignals, totalAnalyzedMessages),
    [frictionSignals, totalAnalyzedMessages]
  );

  const visibleProposals = useMemo(() => {
    if (proposalFilter === 'pending') {
      return improvementProposals.filter(p => p.status === 'pending');
    }
    if (proposalFilter === 'applied') {
      return improvementProposals.filter(p => p.status === 'applied');
    }
    return improvementProposals;
  }, [improvementProposals, proposalFilter]);

  const activeProposal: ImprovementProposal | null =
    visibleProposals.find(p => p.id === selectedProposalId) || visibleProposals[0] || null;

  const notify = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDecision = (id: string, decision: 'applied' | 'dismissed') => {
    resolveImprovement(id, decision);
    notify(
      decision === 'applied'
        ? 'Improvement rule synced to connected model configuration.'
        : 'Proposal dismissed from active queue.'
    );
  };

  const handleScan = () => {
    scanModelsForFriction();
    setProposalFilter('pending');
    notify('Scanned connected model sessions for recurring friction signals.');
  };

  const handleResetBaseline = () => {
    resetImprovementsBaseline();
    setSelectedProposalId(null);
    setProposalFilter('pending');
    notify('Reset telemetry to empty baseline state.');
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackDraft.trim()) return;
    submitImproveFeedback(feedbackDraft);
    setFeedbackDraft('');
    setIsFeedbackOpen(false);
    notify('Feedback recorded for NeuroNest Improve Beta.');
  };

  const chartMax = 2.3;
  const correctionsLine = buildChartPolylinePoints(
    dailySignalSeries.map(d => d.correctionsPct),
    640,
    110,
    chartMax
  );
  const steeringLine = buildChartPolylinePoints(
    dailySignalSeries.map(d => d.steeringPct),
    640,
    110,
    chartMax
  );
  const frustrationLine = buildChartPolylinePoints(
    dailySignalSeries.map(d => d.frustrationPct),
    640,
    110,
    chartMax
  );

  return (
    <div className="rounded-2xl bg-[#141517] border border-[#24262A] overflow-hidden min-h-[calc(100vh-8.5rem)] flex flex-col lg:flex-row">
      {/* ─── LEFT PANE: Improve / Improvements Rail ─── */}
      <div className="w-full lg:w-[310px] xl:w-[340px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#232428] bg-[#141517] p-5 flex flex-col">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-medium mb-4">
          <span className="text-rose-400">
            <FlowerMarkIcon className="w-3.5 h-3.5" />
          </span>
          <span>Improve</span>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-white tracking-tight mb-5">
          Improve
        </h1>

        {/* Section Count Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-[#222327]">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-0.5 rounded-full bg-[#7C5CFC]" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
              IMPROVEMENTS
            </span>
          </div>
          <span className="text-xs font-mono font-semibold text-neutral-400" data-testid="pending-improvements-count">
            {summary.pendingImprovements}
          </span>
        </div>

        {/* Proposal Filter Toggle when applied history exists */}
        {improvementProposals.length > 0 && (
          <div className="flex items-center gap-1 pt-3 pb-1 text-[11px]">
            {(['pending', 'applied', 'all'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setProposalFilter(tab)}
                className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-colors ${
                  proposalFilter === tab
                    ? 'bg-[#25262B] text-white'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* Proposal List OR Exact Empty State */}
        <div className="flex-1 flex flex-col py-4">
          {visibleProposals.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-10 space-y-3">
              {/* Botanical purple bellflower icon */}
              <div className="w-10 h-10 flex items-center justify-center text-[#7C5CFC]">
                <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8">
                  <path
                    d="M19 6C15.5 6 12.2 8.2 11 11.4L9.2 16.2C8.8 17.2 9.8 18.2 10.8 17.7L12.8 16.8L14.1 19.3C14.6 20.2 15.9 20.1 16.3 19.2L17.4 16.8L19.6 17.6C20.6 18 21.6 17 21.1 16L19 11.5C18.4 10.1 18.6 8.3 19.5 7.2L19 6Z"
                    fill="#7C5CFC"
                  />
                  <path
                    d="M15.5 20V27.5M15.5 23.5L19.5 20.5"
                    stroke="#4ADE80"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div className="space-y-1.5">
                <h2 className="text-sm font-semibold text-white">
                  No improvements yet
                </h2>
                <p className="text-xs text-neutral-400 leading-relaxed max-w-[230px]">
                  When your agents record the same friction three times in two conversations, one proposes an improvement here.
                </p>
              </div>

              <button
                type="button"
                onClick={handleScan}
                className="mt-2 px-3 py-1.5 rounded-lg bg-[#212228] hover:bg-[#2A2C34] text-neutral-200 border border-[#30323B] text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <ScanSearch className="w-3.5 h-3.5 text-[#7C5CFC]" />
                <span>Scan Connected Models</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleProposals.map(item => {
                const isSelected = activeProposal?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedProposalId(item.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all space-y-2 ${
                      isSelected
                        ? 'bg-[#1D1E23] border-[#7C5CFC]/70 shadow-sm'
                        : 'bg-[#18191B] border-[#25262B] hover:border-[#34363E]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                      <span
                        className={`px-1.5 py-0.5 rounded uppercase font-semibold ${
                          item.kind === 'correction'
                            ? 'bg-[#251E3E] text-[#A896FF]'
                            : item.kind === 'steering'
                            ? 'bg-blue-950/70 text-blue-300'
                            : 'bg-rose-950/70 text-rose-300'
                        }`}
                      >
                        {item.kind}
                      </span>
                      <span className="text-neutral-400">
                        {item.occurrences}x in {item.conversations} convs
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-white leading-snug">
                      {item.title}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-neutral-400">
                      <span className="truncate font-mono text-neutral-400">{item.targetFile}</span>
                      <span
                        className={`text-[10px] font-mono ${
                          item.status === 'applied'
                            ? 'text-emerald-400'
                            : item.status === 'dismissed'
                            ? 'text-neutral-500'
                            : 'text-amber-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── RIGHT PANE: Metrics, Signal Rates & Rule Inspector ─── */}
      <div className="flex-1 min-w-0 bg-[#121315] p-5 sm:p-7 space-y-5">
        {/* Top Utility Row: Beta Badge + Actions + Share feedback */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-[#222233] border border-[#343452] text-[#A5A1EE] text-[11px] font-medium">
              Beta
            </span>

            <button
              type="button"
              onClick={handleScan}
              className="px-2.5 py-1 rounded-lg bg-[#1A1B1E] hover:bg-[#23252A] border border-[#2A2C32] text-neutral-300 text-[11px] font-medium flex items-center gap-1.5 transition-colors"
            >
              <ScanSearch className="w-3.5 h-3.5 text-emerald-400" />
              <span>Scan Models</span>
            </button>

            <button
              type="button"
              onClick={handleResetBaseline}
              className="px-2.5 py-1 rounded-lg bg-[#1A1B1E] hover:bg-[#23252A] border border-[#2A2C32] text-neutral-400 hover:text-neutral-200 text-[11px] font-medium transition-colors"
              title="Preview baseline empty state (0 improvements & 0.0%)"
            >
              Reset Baseline
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsFeedbackOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-[#1E1F23] hover:bg-[#27292E] border border-[#2F3137] text-neutral-200 text-xs font-medium transition-colors"
          >
            Share feedback
          </button>
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div className="px-3.5 py-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/70 text-emerald-300 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-neutral-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Header Card: Improve + Signals / Clusters Split */}
        <div className="rounded-2xl bg-[#18191B] border border-[#26272B] overflow-hidden">
          <div className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#2A2212] border border-[#45371B] flex items-center justify-center text-[#EAB308] shrink-0">
              <FlowerMarkIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Improve</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Make your agents better at working with you and your repositories.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-[#26272B] bg-[#161719]">
            <div className="px-5 py-3.5 border-r border-[#26272B] space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold">
                SIGNALS
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-200 font-medium">
                <Search className="w-3.5 h-3.5 text-cyan-400/80" />
                <span data-testid="signals-found-count">{summary.signalsFound} found</span>
              </div>
            </div>

            <div className="px-5 py-3.5 space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold">
                CLUSTERS
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-200 font-medium">
                <GitFork className="w-3.5 h-3.5 text-purple-400/80" />
                <span data-testid="clusters-forming-count">{summary.clustersForming} forming</span>
              </div>
            </div>
          </div>
        </div>

        {/* Signal Rates Card */}
        <div className="rounded-2xl bg-[#18191B] border border-[#26272B] p-5 space-y-6">
          {/* Card Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Signal rates</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Share of your messages · last 30 days
                {totalAnalyzedMessages > 0 ? ` (${totalAnalyzedMessages} analyzed)` : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsDetailsOpen(true)}
              className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition-colors shrink-0"
            >
              <Info className="w-3.5 h-3.5" />
              <span>View details</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 3 Semi-Circular Arc Gauges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SignalArcGauge
              label="Corrections"
              pct={rates.correctionsPct}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              accentBorderClass="border-[#7C5CFC]/70"
              comparisonText={
                rates.correctionsPct > 0
                  ? `${rates.correctionsCount} detected · -0.4% vs prev`
                  : 'Comparison pending —'
              }
            />

            <SignalArcGauge
              label="Steering"
              pct={rates.steeringPct}
              icon={<Compass className="w-3.5 h-3.5" />}
              accentBorderClass="border-[#3B82F6]/70"
              comparisonText={
                rates.steeringPct > 0
                  ? `${rates.steeringCount} detected · -0.2% vs prev`
                  : 'Comparison pending —'
              }
            />

            <SignalArcGauge
              label="Frustration"
              pct={rates.frustrationPct}
              icon={<Flame className="w-3.5 h-3.5" />}
              accentBorderClass="border-[#F43F5E]/60"
              comparisonText={
                rates.frustrationPct > 0
                  ? `${rates.frustrationCount} detected · -0.5% vs prev`
                  : 'Comparison pending —'
              }
            />
          </div>

          {/* 30-Day Trend Chart Area */}
          <div className="pt-2">
            <div className="flex gap-3">
              {/* Y-Axis Labels */}
              <div className="flex flex-col justify-between h-32 text-[10px] font-mono text-neutral-500 py-1 select-none shrink-0">
                <span>2.3%</span>
                <span>1.1%</span>
                <span>0.0%</span>
              </div>

              {/* Chart Plot Canvas */}
              <div className="flex-1 flex flex-col">
                <div className="relative h-32 border-b border-[#26272B] flex items-center justify-center">
                  {/* Subtle horizontal gridlines */}
                  <div className="absolute inset-x-0 top-1 border-t border-dashed border-[#242529]" />
                  <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[#242529]" />

                  {dailySignalSeries.length <= 1 ? (
                    <p className="text-xs text-neutral-500 text-center px-4 z-10">
                      The chart appears once you have messages on more than one day.
                    </p>
                  ) : (
                    <svg
                      viewBox="0 0 640 110"
                      preserveAspectRatio="none"
                      className="w-full h-28 overflow-visible"
                      aria-label="30 day signal rates chart"
                    >
                      <polyline
                        fill="none"
                        stroke="#7C5CFC"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={correctionsLine}
                      />
                      <polyline
                        fill="none"
                        stroke="#3B82F6"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={steeringLine}
                      />
                      <polyline
                        fill="none"
                        stroke="#F43F5E"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={frustrationLine}
                      />
                    </svg>
                  )}
                </div>

                {/* X-Axis Labels */}
                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 pt-2">
                  <span>Oct 13</span>
                  <span>Oct 27</span>
                  <span>Today</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Active Proposal Rule Diff Inspector */}
        {activeProposal && (
          <div className="rounded-2xl bg-[#18191B] border border-[#26272B] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#25262B]">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono text-neutral-400">
                  <FileCode2 className="w-3.5 h-3.5 text-[#7C5CFC] shrink-0" />
                  <span className="whitespace-nowrap">{activeProposal.targetFile}</span>
                  <span>·</span>
                  <span className="text-neutral-300 whitespace-nowrap">{activeProposal.repository}</span>
                  <span>·</span>
                  <span className="text-amber-400 whitespace-nowrap">
                    {activeProposal.occurrences} signals in {activeProposal.conversations} conversations
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white">{activeProposal.title}</h3>
              </div>

              {activeProposal.status === 'pending' && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDecision(activeProposal.id, 'dismissed')}
                    className="px-3 py-1.5 rounded-lg bg-[#232429] hover:bg-[#2C2D33] text-neutral-300 text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Dismiss</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision(activeProposal.id, 'applied')}
                    className="px-3.5 py-1.5 rounded-lg bg-[#7C5CFC] hover:bg-[#6D4AF0] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply Improvement</span>
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              {activeProposal.summary} Target model: <span className="text-neutral-200 font-medium">{activeProposal.modelName}</span>.
            </p>

            <div className="rounded-xl bg-[#101113] border border-[#24262C] p-3.5 font-mono text-[11px] space-y-1 overflow-x-auto">
              {activeProposal.diffAfter.split('\n').map((line, i) => {
                const isAdded = line.startsWith('+');
                return (
                  <div
                    key={i}
                    className={
                      isAdded
                        ? 'text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded'
                        : 'text-neutral-400 px-2 py-0.5'
                    }
                  >
                    {line}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── Signal Details Modal ─── */}
      {isDetailsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-[#2B2D31] bg-[#18191B] p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#27282D]">
              <div>
                <h3 className="text-base font-bold text-white">Friction Signal Telemetry</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Captured developer corrections, steering interventions, and frustration markers across connected models.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {frictionSignals.length === 0 ? (
              <div className="py-10 text-center text-xs text-neutral-400 space-y-2">
                <Sparkles className="w-6 h-6 text-[#7C5CFC] mx-auto" />
                <p>No friction signals recorded in the current baseline window.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {frictionSignals.map(sig => (
                  <div
                    key={sig.id}
                    className="p-3.5 rounded-xl bg-[#121315] border border-[#25262B] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded uppercase font-semibold ${
                            sig.kind === 'correction'
                              ? 'bg-[#251E3E] text-[#A896FF]'
                              : sig.kind === 'steering'
                              ? 'bg-blue-950/70 text-blue-300'
                              : 'bg-rose-950/70 text-rose-300'
                          }`}
                        >
                          {sig.kind}
                        </span>
                        <span className="text-neutral-200 font-semibold">{sig.agentName}</span>
                      </div>
                      <span className="text-neutral-500">{sig.timestamp}</span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">{sig.message}</p>
                    <div className="text-[10px] font-mono text-neutral-500">{sig.repository}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Share Feedback Modal ─── */}
      {isFeedbackOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#2B2D31] bg-[#18191B] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="w-4 h-4 text-[#7C5CFC]" />
                <h3 className="text-sm font-bold text-white">Share Improve Beta Feedback</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFeedbackOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="space-y-3">
              <textarea
                rows={4}
                value={feedbackDraft}
                onChange={e => setFeedbackDraft(e.target.value)}
                placeholder="Tell us how signal clustering or rule proposals behave with your connected models..."
                className="w-full p-3 rounded-xl bg-[#111214] border border-[#2A2C32] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#7C5CFC]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFeedbackOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#242529] text-neutral-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#7C5CFC] hover:bg-[#6D4AF0] text-white text-xs font-semibold"
                >
                  Submit Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
