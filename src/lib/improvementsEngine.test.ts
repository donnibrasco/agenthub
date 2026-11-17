import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldProposeImprovement,
  computeSignalRates,
  summarizeImprovementMetrics,
  applyImprovementDecision,
  buildChartPolylinePoints,
  FrictionSignal,
  SignalCluster,
  ImprovementProposal,
} from './improvementsEngine';

test('shouldProposeImprovement enforces 3 occurrences across 2 conversations threshold', () => {
  assert.strictEqual(shouldProposeImprovement(3, 2), true);
  assert.strictEqual(shouldProposeImprovement(4, 3), true);
  assert.strictEqual(shouldProposeImprovement(2, 2), false);
  assert.strictEqual(shouldProposeImprovement(3, 1), false);
});

test('computeSignalRates calculates accurate percentage shares and handles empty message count', () => {
  const signals: FrictionSignal[] = [
    {
      id: 's1',
      kind: 'correction',
      agentId: 'a1',
      agentName: 'Coder',
      repository: 'web-app',
      message: 'No, use Tailwind instead of inline styles',
      timestamp: '10:00 AM',
      dayLabel: 'Today',
    },
    {
      id: 's2',
      kind: 'correction',
      agentId: 'a1',
      agentName: 'Coder',
      repository: 'web-app',
      message: 'Stop putting inline style objects',
      timestamp: '10:05 AM',
      dayLabel: 'Today',
    },
    {
      id: 's3',
      kind: 'steering',
      agentId: 'a2',
      agentName: 'Design',
      repository: 'ui-kit',
      message: 'Check contrast ratio first',
      timestamp: '10:15 AM',
      dayLabel: 'Today',
    },
    {
      id: 's4',
      kind: 'frustration',
      agentId: 'a1',
      agentName: 'Coder',
      repository: 'web-app',
      message: 'You broke the build again without running tsc',
      timestamp: '11:00 AM',
      dayLabel: 'Today',
    },
  ];

  const rates = computeSignalRates(signals, 200);
  assert.strictEqual(rates.correctionsCount, 2);
  assert.strictEqual(rates.steeringCount, 1);
  assert.strictEqual(rates.frustrationCount, 1);
  assert.strictEqual(rates.correctionsPct, 1.0);
  assert.strictEqual(rates.steeringPct, 0.5);
  assert.strictEqual(rates.frustrationPct, 0.5);

  const emptyRates = computeSignalRates(signals, 0);
  assert.strictEqual(emptyRates.correctionsPct, 0);
  assert.strictEqual(emptyRates.steeringPct, 0);
  assert.strictEqual(emptyRates.frustrationPct, 0);
});

test('summarizeImprovementMetrics and applyImprovementDecision update counts accurately', () => {
  const clusters: SignalCluster[] = [
    {
      id: 'c1',
      title: 'Inline style drift',
      kind: 'correction',
      occurrences: 2,
      conversationCount: 1,
      targetFile: '.cursorrules',
      modelNames: ['DeepSeek R1 Distill'],
      status: 'forming',
    },
  ];

  const proposals: ImprovementProposal[] = [
    {
      id: 'imp1',
      clusterId: 'c0',
      title: 'Run tsc before finishing',
      summary: 'Always verify types',
      modelId: 'agent_coder',
      modelName: 'DeepSeek R1 Distill',
      repository: 'creativeprocess/core',
      targetFile: '.cursorrules',
      occurrences: 3,
      conversations: 2,
      kind: 'correction',
      ruleSnippet: '- Run tsc --noEmit',
      diffBefore: '# Rules',
      diffAfter: '# Rules\n+ Run tsc --noEmit',
      status: 'pending',
      detectedAt: '2h ago',
    },
  ];

  const before = summarizeImprovementMetrics([], clusters, proposals);
  assert.strictEqual(before.clustersForming, 1);
  assert.strictEqual(before.pendingImprovements, 1);
  assert.strictEqual(before.appliedImprovements, 0);

  const updated = applyImprovementDecision(proposals, 'imp1', 'applied');
  const after = summarizeImprovementMetrics([], clusters, updated);
  assert.strictEqual(after.pendingImprovements, 0);
  assert.strictEqual(after.appliedImprovements, 1);
});

test('buildChartPolylinePoints computes valid SVG coordinate pairs', () => {
  const pts = buildChartPolylinePoints([0, 1.15, 2.3], 100, 50, 2.3);
  assert.strictEqual(pts, '0.0,50.0 50.0,25.0 100.0,0.0');
});
