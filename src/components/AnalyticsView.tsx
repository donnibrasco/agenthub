import React from 'react';
import { LineChart, Clock, Coins, CheckCircle2, Cpu, HardDrive } from 'lucide-react';

export function AnalyticsView() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#1B1C1E] border border-[#27292C]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Performance & Token Analytics</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Real-time inference latencies, token consumption, and cost savings across your agent fleet.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#D7E6FF] text-[#111827] space-y-2">
          <span className="text-xs text-neutral-600 font-medium block">Total Inference Tokens</span>
          <span className="text-2xl font-bold font-sans">184,200</span>
          <span className="text-[11px] text-neutral-700 block">+14% this week</span>
        </div>
        <div className="p-5 rounded-2xl bg-[#E5F3DD] text-[#111827] space-y-2">
          <span className="text-xs text-neutral-600 font-medium block">Average Latency (p50)</span>
          <span className="text-2xl font-bold font-sans">280 ms</span>
          <span className="text-[11px] text-emerald-800 block">SLA &lt;800ms met</span>
        </div>
        <div className="p-5 rounded-2xl bg-[#FDF4B8] text-[#111827] space-y-2">
          <span className="text-xs text-neutral-600 font-medium block">Estimated API Spend</span>
          <span className="text-2xl font-bold font-sans">$14.28</span>
          <span className="text-[11px] text-neutral-700 block">68% saved via local models</span>
        </div>
        <div className="p-5 rounded-2xl bg-[#F0E6FA] text-[#111827] space-y-2">
          <span className="text-xs text-neutral-600 font-medium block">SLA Compliance</span>
          <span className="text-2xl font-bold font-sans">99.8%</span>
          <span className="text-[11px] text-neutral-700 block">Zero unhandled crashes</span>
        </div>
      </div>

      {/* Latency Distribution */}
      <div className="p-6 rounded-3xl bg-[#1D1E20] border border-[#27292C] space-y-4">
        <h3 className="text-sm font-bold text-white">Percentile Breakdown</h3>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="p-3 rounded-2xl bg-[#141517] border border-[#2A2B2E]">
            <span className="text-[10px] text-neutral-500 uppercase font-mono block">p50</span>
            <span className="text-xl font-bold text-white font-mono">240ms</span>
          </div>
          <div className="p-3 rounded-2xl bg-[#141517] border border-[#2A2B2E]">
            <span className="text-[10px] text-neutral-500 uppercase font-mono block">p90</span>
            <span className="text-xl font-bold text-blue-400 font-mono">380ms</span>
          </div>
          <div className="p-3 rounded-2xl bg-[#141517] border border-[#2A2B2E]">
            <span className="text-[10px] text-neutral-500 uppercase font-mono block">p95</span>
            <span className="text-xl font-bold text-amber-400 font-mono">510ms</span>
          </div>
          <div className="p-3 rounded-2xl bg-[#141517] border border-[#2A2B2E]">
            <span className="text-[10px] text-neutral-500 uppercase font-mono block">p99</span>
            <span className="text-xl font-bold text-rose-400 font-mono">790ms</span>
          </div>
        </div>
      </div>
    </div>
  );
}
