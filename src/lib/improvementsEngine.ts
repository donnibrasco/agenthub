export type SignalKind = 'correction' | 'steering' | 'frustration';

export interface FrictionSignal {
  id: string;
  kind: SignalKind;
  agentId: string;
  agentName: string;
  repository: string;
  message: string;
  timestamp: string;
  dayLabel: string;
}

export interface SignalCluster {
  id: string;
  title: string;
  kind: SignalKind;
  occurrences: number;
  conversationCount: number;
  targetFile: string;
  modelNames: string[];
  status: 'forming' | 'ready';
}

export interface ImprovementProposal {
  id: string;
  clusterId: string;
  title: string;
  summary: string;
  modelId: string;
  modelName: string;
  repository: string;
  targetFile: '.cursorrules' | 'CLAUDE.md' | 'AGENT_RULES.md' | 'SYSTEM_PROMPT.md';
  occurrences: number;
  conversations: number;
  kind: SignalKind;
  ruleSnippet: string;
  diffBefore: string;
  diffAfter: string;
  status: 'pending' | 'applied' | 'dismissed';
  detectedAt: string;
}

export interface DailySignalPoint {
  dateLabel: string;
  correctionsPct: number;
  steeringPct: number;
  frustrationPct: number;
  messageCount: number;
}

export interface SignalRatesSummary {
  correctionsPct: number;
  steeringPct: number;
  frustrationPct: number;
  correctionsCount: number;
  steeringCount: number;
  frustrationCount: number;
}

/**
 * Matches the blume.codes rule:
 * "When your agents record the same friction three times in two conversations,
 * one proposes an improvement here."
 */
export function shouldProposeImprovement(occurrences: number, conversations: number): boolean {
  return occurrences >= 3 && conversations >= 2;
}

/**
 * Computes percentage share of messages triggering each friction signal kind.
 */
export function computeSignalRates(
  signals: FrictionSignal[],
  totalMessages: number
): SignalRatesSummary {
  const correctionsCount = signals.filter(s => s.kind === 'correction').length;
  const steeringCount = signals.filter(s => s.kind === 'steering').length;
  const frustrationCount = signals.filter(s => s.kind === 'frustration').length;

  if (totalMessages <= 0) {
    return {
      correctionsPct: 0,
      steeringPct: 0,
      frustrationPct: 0,
      correctionsCount,
      steeringCount,
      frustrationCount,
    };
  }

  const toPct = (count: number) => Math.round((count / totalMessages) * 1000) / 10;

  return {
    correctionsPct: toPct(correctionsCount),
    steeringPct: toPct(steeringCount),
    frustrationPct: toPct(frustrationCount),
    correctionsCount,
    steeringCount,
    frustrationCount,
  };
}

/**
 * Summarizes signal counts and active clusters.
 */
export function summarizeImprovementMetrics(
  signals: FrictionSignal[],
  clusters: SignalCluster[],
  proposals: ImprovementProposal[]
): {
  signalsFound: number;
  clustersForming: number;
  pendingImprovements: number;
  appliedImprovements: number;
} {
  return {
    signalsFound: signals.length,
    clustersForming: clusters.filter(c => c.status === 'forming').length,
    pendingImprovements: proposals.filter(p => p.status === 'pending').length,
    appliedImprovements: proposals.filter(p => p.status === 'applied').length,
  };
}

/**
 * Applies a developer decision ('applied' or 'dismissed') to an improvement proposal.
 */
export function applyImprovementDecision(
  proposals: ImprovementProposal[],
  proposalId: string,
  decision: 'applied' | 'dismissed'
): ImprovementProposal[] {
  return proposals.map(p => (p.id === proposalId ? { ...p, status: decision } : p));
}

/**
 * Converts a numeric series into SVG polyline coordinate string.
 */
export function buildChartPolylinePoints(
  values: number[],
  width: number,
  height: number,
  maxValue: number
): string {
  if (values.length === 0) return '';
  if (values.length === 1) {
    const y = height - (Math.min(values[0], maxValue) / (maxValue || 1)) * height;
    return `0,${y.toFixed(1)} ${width},${y.toFixed(1)}`;
  }

  const safeMax = maxValue > 0 ? maxValue : 1;
  return values
    .map((val, idx) => {
      const x = (idx / (values.length - 1)) * width;
      const clamped = Math.max(0, Math.min(val, safeMax));
      const y = height - (clamped / safeMax) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
