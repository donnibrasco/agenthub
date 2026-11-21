import React, { useState, useMemo } from 'react';
import { useEscapeKey } from '../lib/useEscapeKey';
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
  countLabel: string;
}

function SignalArcGauge({
  label,
  pct,
  icon,
  accentBorderClass,
  countLabel,
}: GaugeProps) {
  // Semi-circular arc from (18, 90) to (162, 90) with radius 72 -> circumference = PI * 72 ~= 226.19
  const radius = 72;
  const arcLength = Math.PI * radius;
  const normalizedRatio = Math.max(0, Math.min(pct / 100, 1));
  const filledDash = normalizedRatio * arcLength;
  const gradId = `gauge-grad-${label.toLowerCase()}`;

  return (
    <div className={`flex flex-col pb-4 border-b-2 ${accentBorderClass}`}>
      <div className="flex items-center gap-1.5 text-xs text-[#4b4941] font-medium mb-3">
        <span className="text-[#665f54]">{icon}</span>
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
          <div className="text-2xl font-semibold font-mono text-[#282820] tracking-tight">
            {pct.toFixed(1)}%
          </div>
          <div className="text-xs text-[#777064] mt-1 flex items-center justify-center gap-1">
            <span>{countLabel}</span>
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
    refreshImprovements,
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

  useEscapeKey(isDetailsOpen || isFeedbackOpen, () => {
    setIsDetailsOpen(false);
    setIsFeedbackOpen(false);
  });

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
        ? 'Proposal marked as applied.'
        : 'Proposal dismissed from active queue.'
    );
  };

  const handleRefresh = async () => {
    try {
      await refreshImprovements();
      notify('Telemetry refreshed.');
    } catch {
      notify('Could not refresh telemetry.');
    }
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
    notify('Feedback recorded for AgentHub Improve Beta.');
  };

  const chartMax = Math.max(1, Math.ceil(Math.max(0, ...dailySignalSeries.flatMap(day => [
    day.correctionsPct, day.steeringPct, day.frustrationPct,
  ]))));
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
    <div className="rounded-2xl bg-[#fffdfa] border border-[#e7e2d9] overflow-hidden min-h-[calc(100vh-8.5rem)] flex flex-col lg:flex-row">
      {/* ─── LEFT PANE: Improve / Improvements Rail ─── */}
      <div className="w-full lg:w-[310px] xl:w-[340px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#e7e2d9] bg-[#fffdfa] p-5 flex flex-col">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-[#4b4941] font-medium mb-4">
          <span className="text-[#922d1d]">
            <FlowerMarkIcon className="w-3.5 h-3.5" />
          </span>
          <span>Improve</span>
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-semibold tracking-tight text-[#282820] mb-5">
          Improve
        </h1>

        {/* Section Count Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-[#e7e2d9]">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-0.5 rounded-full bg-[#5b4bb0]" />
            <span className="text-xs text-[#665f54] font-semibold">
              IMPROVEMENTS
            </span>
          </div>
          <span className="text-xs font-mono font-semibold text-[#665f54]" data-testid="pending-improvements-count">
            {summary.pendingImprovements}
          </span>
        </div>

        {/* Proposal Filter Toggle when applied history exists */}
        {improvementProposals.length > 0 && (
          <div className="flex items-center gap-1 pt-3 pb-1 text-xs">
            {(['pending', 'applied', 'all'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setProposalFilter(tab)}
                className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-colors ${
                  proposalFilter === tab
                    ? 'bg-[#f2eee6] text-[#282820]'
                    : 'text-[#777064] hover:text-[#4b4941]'
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
              <div className="w-10 h-10 flex items-center justify-center text-[#5b4bb0]">
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
                <h2 className="text-sm font-semibold text-[#282820]">
                  No improvements yet
                </h2>
                <p className="text-xs text-[#665f54] leading-relaxed max-w-[230px]">
                  A proposal appears after the same kind of friction is recorded three times for a repository.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                className="mt-2 px-3 py-1.5 rounded-lg bg-[#f2eee6] hover:bg-[#ede9e0] text-[#282820] border border-[#d8d3ca] text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <ScanSearch className="w-3.5 h-3.5 text-[#5b4bb0]" />
                <span>Refresh telemetry</span>
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
                        ? 'bg-[#f2eee6] border-[#5b4bb0]/40 shadow-sm'
                        : 'bg-[#fffdfa] border-[#e7e2d9] hover:border-[#d8d3ca]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-mono">
                      <span
                        className={`px-1.5 py-0.5 rounded uppercase font-semibold ${
                          item.kind === 'correction'
                            ? 'bg-[#eeeaf7] text-[#5b4bb0]'
                            : item.kind === 'steering'
                            ? 'bg-[#e8eef6] text-[#2f5d8a]'
                            : 'bg-[#f9ece4] text-[#922d1d]'
                        }`}
                      >
                        {item.kind}
                      </span>
                      <span className="text-[#665f54]">
                        {item.occurrences} signals
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-[#282820] leading-snug">
                      {item.title}
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#665f54]">
                      <span className="truncate font-mono text-[#665f54]">{item.targetFile}</span>
                      <span
                        className={`text-xs font-mono ${
                          item.status === 'applied'
                            ? 'text-[#1f6b5f]'
                            : item.status === 'dismissed'
                            ? 'text-[#777064]'
                            : 'text-[#8a6418]'
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
      <div className="flex-1 min-w-0 bg-[#fffdfa] p-5 sm:p-7 space-y-5">
        {/* Top Utility Row: Beta Badge + Actions + Share feedback */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-[#e8eef6] border border-[#2f5d8a]/25 text-[#5b4bb0] text-xs font-medium">
              Beta
            </span>

            <button
              type="button"
              onClick={handleRefresh}
              className="px-2.5 py-1 rounded-lg bg-[#fffdfa] hover:bg-[#ede9e0] border border-[#e7e2d9] text-[#4b4941] text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <ScanSearch className="w-3.5 h-3.5 text-[#1f6b5f]" />
              <span>Refresh telemetry</span>
            </button>

            <button
              type="button"
              onClick={handleResetBaseline}
              className="px-2.5 py-1 rounded-lg bg-[#fffdfa] hover:bg-[#ede9e0] border border-[#e7e2d9] text-[#665f54] hover:text-[#282820] text-xs font-medium transition-colors"
              title="Clear recorded telemetry for the current baseline"
            >
              Reset Baseline
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsFeedbackOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-[#f2eee6] hover:bg-[#ede9e0] border border-[#d8d3ca] text-[#282820] text-xs font-medium transition-colors"
          >
            Share feedback
          </button>
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div className="px-3.5 py-2.5 rounded-xl bg-[#e9f2eb] border border-[#166b66]/25 text-[#1f6b5f] text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#1f6b5f]" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-[#665f54] hover:text-[#282820]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Header Card: Improve + Signals / Clusters Split */}
        <div className="rounded-2xl bg-[#fffdfa] border border-[#e7e2d9] overflow-hidden">
          <div className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#f7eed7] border border-[#987529]/25 flex items-center justify-center text-[#8a6418] shrink-0">
              <FlowerMarkIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#282820] tracking-tight">Improve</h2>
              <p className="text-xs text-[#665f54] mt-0.5">
                Make your agents better at working with you and your repositories.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-[#e7e2d9] bg-[#fffdfa]">
            <div className="px-5 py-3.5 border-r border-[#e7e2d9] space-y-1">
              <div className="text-xs text-[#777064] font-semibold">
                SIGNALS
              </div>
              <div className="flex items-center gap-2 text-xs text-[#282820] font-medium">
                <Search className="w-3.5 h-3.5 text-[#216b80]" />
                <span data-testid="signals-found-count">{summary.signalsFound} found</span>
              </div>
            </div>

            <div className="px-5 py-3.5 space-y-1">
              <div className="text-xs text-[#777064] font-semibold">
                CLUSTERS
              </div>
              <div className="flex items-center gap-2 text-xs text-[#282820] font-medium">
                <GitFork className="w-3.5 h-3.5 text-[#5b4bb0]" />
                <span data-testid="clusters-forming-count">{summary.clustersForming} forming</span>
              </div>
            </div>
          </div>
        </div>

        {/* Signal Rates Card */}
        <div className="rounded-2xl bg-[#fffdfa] border border-[#e7e2d9] p-5 space-y-6">
          {/* Card Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#282820]">Signal rates</h3>
              <p className="text-xs text-[#665f54] mt-0.5">
                Share of recorded telemetry events
                {totalAnalyzedMessages > 0 ? ` (${totalAnalyzedMessages} analyzed)` : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsDetailsOpen(true)}
              className="text-xs text-[#665f54] hover:text-[#282820] flex items-center gap-1 transition-colors shrink-0"
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
              accentBorderClass="border-[#5b4bb0]/40"
              countLabel={`${rates.correctionsCount} recorded`}
            />

            <SignalArcGauge
              label="Steering"
              pct={rates.steeringPct}
              icon={<Compass className="w-3.5 h-3.5" />}
              accentBorderClass="border-[#2f5d8a]/40"
              countLabel={`${rates.steeringCount} recorded`}
            />

            <SignalArcGauge
              label="Frustration"
              pct={rates.frustrationPct}
              icon={<Flame className="w-3.5 h-3.5" />}
              accentBorderClass="border-[#a44e32]/40"
              countLabel={`${rates.frustrationCount} recorded`}
            />
          </div>

          {/* Daily trend */}
          <div className="pt-2">
            <div className="flex gap-3">
              {/* Y-Axis Labels */}
              <div className="flex flex-col justify-between h-32 text-xs font-mono text-[#777064] py-1 select-none shrink-0">
                <span>{chartMax}%</span>
                <span>{chartMax / 2}%</span>
                <span>0.0%</span>
              </div>

              {/* Chart Plot Canvas */}
              <div className="flex-1 flex flex-col">
                <div className="relative h-32 border-b border-[#e7e2d9] flex items-center justify-center">
                  {/* Subtle horizontal gridlines */}
                  <div className="absolute inset-x-0 top-1 border-t border-dashed border-[#e7e2d9]" />
                  <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[#e7e2d9]" />

                  {dailySignalSeries.length <= 1 ? (
                    <p className="text-xs text-[#777064] text-center px-4 z-10">
                      The chart appears after telemetry is recorded on two days.
                    </p>
                  ) : (
                    <svg
                      viewBox="0 0 640 110"
                      preserveAspectRatio="none"
                      className="w-full h-28 overflow-visible"
                      aria-label="Daily signal rates chart"
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
                {dailySignalSeries.length > 1 && (
                  <div className="flex items-center justify-between text-xs font-mono text-[#777064] pt-2">
                    <span>{dailySignalSeries[0].dateLabel}</span>
                    <span>{dailySignalSeries[dailySignalSeries.length - 1].dateLabel}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Active Proposal Rule Diff Inspector */}
        {activeProposal && (
          <div className="rounded-2xl bg-[#fffdfa] border border-[#e7e2d9] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e7e2d9]">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-[#665f54]">
                  <FileCode2 className="w-3.5 h-3.5 text-[#5b4bb0] shrink-0" />
                  <span className="whitespace-nowrap">{activeProposal.targetFile}</span>
                  <span>·</span>
                  <span className="text-[#4b4941] whitespace-nowrap">{activeProposal.repository}</span>
                  <span>·</span>
                  <span className="text-[#8a6418] whitespace-nowrap">
                    {activeProposal.occurrences} signals
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[#282820]">{activeProposal.title}</h3>
              </div>

              {activeProposal.status === 'pending' && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDecision(activeProposal.id, 'dismissed')}
                    className="px-3 py-1.5 rounded-lg bg-[#f2eee6] hover:bg-[#ede9e0] text-[#4b4941] text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Dismiss</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision(activeProposal.id, 'applied')}
                    className="px-3.5 py-1.5 rounded-lg bg-[#5b4bb0] hover:bg-[#4c3e98] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark as applied</span>
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-[#665f54] leading-relaxed">
              {activeProposal.summary} Target model: <span className="text-[#282820] font-medium">{activeProposal.modelName}</span>.
            </p>

            <div className="rounded-xl bg-[#faf8f4] border border-[#e7e2d9] p-3.5 font-mono text-xs space-y-1 overflow-x-auto">
              {activeProposal.diffAfter.split('\n').map((line, i) => {
                const isAdded = line.startsWith('+');
                return (
                  <div
                    key={i}
                    className={
                      isAdded
                        ? 'text-[#1f6b5f] bg-[#e9f2eb] px-2 py-0.5 rounded'
                        : 'text-[#665f54] px-2 py-0.5'
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#26251e]/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-[#e7e2d9] bg-[#fffdfa] p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#e7e2d9]">
              <div>
                <h3 className="text-base font-semibold text-[#282820]">Friction Signal Telemetry</h3>
                <p className="text-xs text-[#665f54] mt-0.5">
                  Captured developer corrections, steering interventions, and frustration markers across connected models.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="text-[#665f54] hover:text-[#282820] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {frictionSignals.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#665f54] space-y-2">
                <Sparkles className="w-6 h-6 text-[#5b4bb0] mx-auto" />
                <p>No friction signals recorded in the current baseline window.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {frictionSignals.map(sig => (
                  <div
                    key={sig.id}
                    className="p-3.5 rounded-xl bg-[#fffdfa] border border-[#e7e2d9] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded uppercase font-semibold ${
                            sig.kind === 'correction'
                              ? 'bg-[#eeeaf7] text-[#5b4bb0]'
                              : sig.kind === 'steering'
                              ? 'bg-[#e8eef6] text-[#2f5d8a]'
                              : 'bg-[#f9ece4] text-[#922d1d]'
                          }`}
                        >
                          {sig.kind}
                        </span>
                        <span className="text-[#282820] font-semibold">{sig.agentName}</span>
                      </div>
                      <span className="text-[#777064]">{sig.timestamp}</span>
                    </div>
                    <p className="text-xs text-[#4b4941] leading-relaxed">{sig.message}</p>
                    <div className="text-xs font-mono text-[#777064]">{sig.repository}</div>
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#26251e]/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#e7e2d9] bg-[#fffdfa] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="w-4 h-4 text-[#5b4bb0]" />
                <h3 className="text-sm font-semibold text-[#282820]">Share Improve Beta Feedback</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFeedbackOpen(false)}
                className="text-[#665f54] hover:text-[#282820]"
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
                className="w-full p-3 rounded-xl bg-[#faf8f4] border border-[#e7e2d9] text-xs text-[#282820] placeholder-[#777064] focus:outline-none focus:border-[#5b4bb0]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFeedbackOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#f2eee6] text-[#4b4941] text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#5b4bb0] hover:bg-[#4c3e98] text-white text-xs font-semibold"
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
