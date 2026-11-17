/**
 * Performance metrics and telemetry analytics calculations for AI agent fleets.
 */

export interface LatencyPercentiles {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
}

/**
 * Calculates p50, p90, p95, and p99 percentiles from a series of latency numbers
 */
export function calculatePercentiles(latencies: number[]): LatencyPercentiles {
  if (!latencies || latencies.length === 0) {
    return { p50: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const len = sorted.length;

  const getPercentile = (p: number) => {
    const idx = Math.min(len - 1, Math.max(0, Math.ceil((p / 100) * len) - 1));
    return Math.round(sorted[idx]);
  };

  const sum = sorted.reduce((acc, val) => acc + val, 0);

  return {
    p50: getPercentile(50),
    p90: getPercentile(90),
    p95: getPercentile(95),
    p99: getPercentile(99),
    min: Math.round(sorted[0]),
    max: Math.round(sorted[len - 1]),
    avg: Math.round(sum / len)
  };
}

/**
 * Pricing rates per 1,000 tokens (USD)
 */
export const MODEL_PRICING: Record<string, { promptPer1k: number; completionPer1k: number }> = {
  'gemini-2.5-flash': { promptPer1k: 0.000075, completionPer1k: 0.0003 },
  'gemini-1.5-pro': { promptPer1k: 0.00125, completionPer1k: 0.005 },
  'claude-3-7-sonnet': { promptPer1k: 0.003, completionPer1k: 0.015 },
  'deepseek-r1-distill': { promptPer1k: 0.00055, completionPer1k: 0.00219 }, // self-hosted electricity/compute equivalent
  'llama3.3:70b': { promptPer1k: 0.0004, completionPer1k: 0.0016 },
  'qwen2.5-coder:32b': { promptPer1k: 0.0001, completionPer1k: 0.0002 }, // local compute cost estimation
  'local-default': { promptPer1k: 0.00005, completionPer1k: 0.0001 }
};

/**
 * Computes estimated cost in USD based on model and token counts
 */
export function estimateTokenCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  cachedTokens: number = 0
): number {
  const normalizedKey = Object.keys(MODEL_PRICING).find(k => model.toLowerCase().includes(k)) || 'local-default';
  const rates = MODEL_PRICING[normalizedKey];

  // Cached tokens get a 50% discount on prompt rate
  const netPromptTokens = Math.max(0, promptTokens - cachedTokens);
  const promptCost = (netPromptTokens / 1000) * rates.promptPer1k;
  const cachedCost = (cachedTokens / 1000) * (rates.promptPer1k * 0.5);
  const completionCost = (completionTokens / 1000) * rates.completionPer1k;

  const total = promptCost + cachedCost + completionCost;
  return Number(total.toFixed(6));
}

/**
 * Calculates SLA compliance percentage: traces with latency <= threshold and status 'success'
 */
export function calculateSlaCompliance(
  traces: Array<{ totalDurationMs: number; status: string }>,
  maxLatencyThresholdMs: number = 2000
): number {
  if (!traces || traces.length === 0) return 100;
  const compliant = traces.filter(t => t.status === 'success' && t.totalDurationMs <= maxLatencyThresholdMs);
  return Number(((compliant.length / traces.length) * 100).toFixed(2));
}

/**
 * Aggregates error taxonomy
 */
export function aggregateErrorTaxonomy(
  traces: Array<{ status: string; errorType?: string }>
): Record<string, number> {
  const result: Record<string, number> = {
    TIMEOUT_504: 0,
    RATE_LIMIT_429: 0,
    SCHEMA_VIOLATION: 0,
    OOM_ERROR: 0,
    SAFETY_BLOCK: 0,
    UNKNOWN: 0
  };

  traces.forEach(t => {
    if (t.status === 'error') {
      const type = t.errorType || 'UNKNOWN';
      result[type] = (result[type] || 0) + 1;
    }
  });

  return result;
}
