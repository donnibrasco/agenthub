import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSessionForDrift, generateRuleFromDrift } from './driftDetector';
import { SessionEvent } from '../types';

test('analyzeSessionForDrift detects styling discipline drift from corrections', () => {
  const events: SessionEvent[] = [
    {
      id: 'e1',
      timestamp: '10:00:00',
      type: 'prompt',
      content: 'Refactor navbar buttons'
    },
    {
      id: 'e2',
      timestamp: '10:00:15',
      type: 'correction',
      content: 'No, do not use inline styles, always use Tailwind CSS classes!'
    }
  ];

  const drifts = analyzeSessionForDrift('sess_1', 'Claude Code', events);
  assert.equal(drifts.length, 1);
  assert.equal(drifts[0].category, 'architecture_drift');
  assert.equal(drifts[0].suggestedRuleId, 'rule_tailwind_only');
});

test('analyzeSessionForDrift detects verification drift from test/lint corrections', () => {
  const events: SessionEvent[] = [
    {
      id: 'e1',
      timestamp: '10:05:00',
      type: 'correction',
      content: 'You forgot to run the unit tests and the lint check failed.'
    }
  ];

  const drifts = analyzeSessionForDrift('sess_2', 'Cursor', events);
  assert.equal(drifts.length, 1);
  assert.equal(drifts[0].category, 'tool_discipline');
  assert.equal(drifts[0].suggestedRuleId, 'rule_verify_before_finish');
});

test('generateRuleFromDrift synthesizes rule diff with target file and snippets', () => {
  const incident = {
    id: 'drift_123',
    sessionId: 'sess_1',
    agentName: 'Claude Code',
    title: 'Styling Discipline Drift',
    category: 'architecture_drift' as const,
    description: 'Inline styles instead of Tailwind',
    detectedSnippet: 'style={{ color: "red" }}',
    developerCorrection: 'Use Tailwind text-red-500 instead',
    suggestedRuleId: 'rule_tailwind_only',
    timestamp: '10:00:00',
    status: 'pending' as const
  };

  const rule = generateRuleFromDrift(incident);
  assert.equal(rule.id, 'rule_tailwind_only');
  assert.equal(rule.targetFile, '.cursorrules');
  assert.ok(rule.ruleSnippet.includes('Tailwind'));
  assert.ok(rule.diffPreview.after.includes('+'));
});
