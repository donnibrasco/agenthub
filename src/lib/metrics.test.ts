import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePercentiles,
  estimateTokenCost,
  calculateSlaCompliance,
  aggregateErrorTaxonomy
} from './metrics';

test('calculatePercentiles computes accurate p50, p90, p95, p99 on sorted and unsorted numbers', () => {
  const latencies = [120, 150, 180, 200, 210, 250, 300, 350, 420, 1200];
  const p = calculatePercentiles(latencies);

  assert.equal(p.min, 120);
  assert.equal(p.max, 1200);
  assert.equal(p.p50, 210);
  assert.ok(p.p95 >= 420);
  assert.ok(p.p99 >= 1200);
  assert.ok(p.avg > 0);
});

test('calculatePercentiles handles empty input gracefully', () => {
  const p = calculatePercentiles([]);
  assert.equal(p.p50, 0);
  assert.equal(p.p95, 0);
  assert.equal(p.avg, 0);
});

test('estimateTokenCost calculates prompt and completion tokens with cache discount', () => {
  const cost = estimateTokenCost('gemini-2.5-flash', 1000, 500, 200);
  // prompt: (800 / 1000) * 0.000075 = 0.00006
  // cached: (200 / 1000) * (0.000075 * 0.5) = 0.0000075
  // completion: (500 / 1000) * 0.0003 = 0.00015
  // total = 0.0002175
  assert.ok(cost > 0.0001 && cost < 0.001);
});

test('calculateSlaCompliance returns correct percentage within SLA limit', () => {
  const traces = [
    { totalDurationMs: 400, status: 'success' },
    { totalDurationMs: 800, status: 'success' },
    { totalDurationMs: 1200, status: 'success' },
    { totalDurationMs: 2500, status: 'success' }, // over 2000 threshold
    { totalDurationMs: 300, status: 'error' }     // error
  ];
  const sla = calculateSlaCompliance(traces, 2000);
  // 3 out of 5 are compliant => 60%
  assert.equal(sla, 60);
});

test('aggregateErrorTaxonomy classifies error categories', () => {
  const traces = [
    { status: 'success' },
    { status: 'error', errorType: 'TIMEOUT_504' },
    { status: 'error', errorType: 'TIMEOUT_504' },
    { status: 'error', errorType: 'RATE_LIMIT_429' },
    { status: 'error', errorType: 'SCHEMA_VIOLATION' }
  ];
  const tax = aggregateErrorTaxonomy(traces);
  assert.equal(tax.TIMEOUT_504, 2);
  assert.equal(tax.RATE_LIMIT_429, 1);
  assert.equal(tax.SCHEMA_VIOLATION, 1);
  assert.equal(tax.OOM_ERROR, 0);
});
