import React, { useState } from 'react';
import { Markdown } from './Markdown';
import { useNeuro } from '../context/NeuroContext';
import { Activity, ArrowRight, Bot, ChevronDown, Database, ListTodo, Plug } from 'lucide-react';

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const fullDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function formatWhen(createdAt: string | undefined, fallback: string) {
  const time = createdAt ? Date.parse(createdAt) : NaN;
  if (Number.isNaN(time)) return fallback;
  const minutes = Math.round((time - Date.now()) / 60000);
  if (minutes > -1) return 'Just now';
  if (minutes > -60) return relative.format(minutes, 'minute');
  if (minutes > -60 * 24) return relative.format(Math.round(minutes / 60), 'hour');
  return fullDate.format(time);
}

export function DashboardView() {
  const { agents, activities, jobs, searchQuery, setActiveLaunchAgent, setIsConnectModalOpen, setEditingModel } = useNeuro();
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleAgents = normalizedQuery
    ? agents.filter(
        a =>
          a.name.toLowerCase().includes(normalizedQuery) ||
          a.description.toLowerCase().includes(normalizedQuery) ||
          a.model.toLowerCase().includes(normalizedQuery)
      )
    : agents;

  const visibleActivities = normalizedQuery
    ? activities.filter(
        act =>
          act.title.toLowerCase().includes(normalizedQuery) ||
          act.snippet.toLowerCase().includes(normalizedQuery) ||
          act.modelTag.toLowerCase().includes(normalizedQuery)
      )
    : activities;

  const stats = [
    { label: 'Connected models', count: agents.length, icon: Bot, color: 'bg-[#e9f2eb] border border-[#166b66]/15' },
    { label: 'Active models', count: agents.filter(agent => agent.status === 'Active').length, icon: Activity, color: 'bg-[#e8eef6] border border-[#2f5d8a]/15' },
    { label: 'Open jobs', count: jobs.filter(job => job.status === 'queued' || job.status === 'in_progress').length, icon: ListTodo, color: 'bg-[#f7eed7] border border-[#987529]/15' },
    { label: 'Reported tokens', count: agents.reduce((sum, agent) => sum + agent.tokens, 0), icon: Database, color: 'bg-[#eeeaf7] border border-[#5b4bb0]/15' },
  ];

  return (
    <div className="space-y-7">
      <div className="rounded-3xl bg-[#fffdfa] border border-[#e7e2d9] p-7 md:p-9">
        <h1 className="text-3xl font-semibold tracking-tight text-[#282820] sm:text-4xl">AgentHub workspace</h1>
        <p className="mt-2 text-sm text-[#665f54]">Connect models, run prompts, and review your workspace activity.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, count, icon: Icon, color }) => (
          <div key={label} className={`p-5 rounded-2xl ${color} text-[#282820] space-y-3`}>
            <div className="w-8 h-8 rounded-full bg-[#fffdfa]/80 flex items-center justify-center text-[#08666c]">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-3xl font-semibold tracking-tight">{count.toLocaleString()}</div>
              <div className="text-xs font-medium text-[#4b4941] mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* MAIN 2-COLUMN SPLIT: Quick Launch Agents & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Column 1: Connected Models */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#282820] tracking-tight">
              Connected Agents
            </h2>
            <button
              type="button"
              onClick={() => {
                setEditingModel(null);
                setIsConnectModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#e9f2eb] hover:bg-[#dfece4] border border-[#166b66]/25 text-[#1f6b5f] text-xs font-semibold transition-colors"
            >
              <Plug className="w-3 h-3" />
              <span>Connect Agent</span>
            </button>
          </div>

          <div className="space-y-3.5">
            {visibleAgents.length === 0 && (
              <p className="p-5 rounded-2xl border border-[#e7e2d9] text-sm text-[#665f54]">
                {agents.length ? 'No connected models match your search.' : 'Connect a model to send your first prompt.'}
              </p>
            )}
            {visibleAgents.map(agent => (
              <div
                key={agent.id}
                className="p-5 rounded-2xl bg-[#fffdfa] border border-[#e7e2d9] space-y-3 hover:border-[#d8d3ca] transition-colors shadow-sm"
              >
                {/* Header: Date + Active Status pill */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#777064] font-sans">{agent.date}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    agent.status === 'Active' ? 'bg-[#e9f2eb] text-[#1f6b5f] border-[#166b66]/25' : 'bg-[#ede9e0] text-[#4b4941] border-[#d8d3ca]'
                  }`}>
                    <span>{agent.status}</span>
                  </span>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-base font-semibold text-[#282820] tracking-tight">
                    {agent.name}
                  </h3>
                  <p className="text-xs text-[#665f54] mt-1 line-clamp-2 leading-relaxed">
                    {agent.description}
                  </p>
                </div>

                {/* Footer Telemetry & Quick Launch Button */}
                <div className="flex items-center justify-between pt-2 border-t border-[#e7e2d9] text-xs">
                  <div className="flex items-center gap-2 text-[#665f54]">
                    <Database className="w-3.5 h-3.5 text-[#777064]" />
                    <span className="tabular-nums">{agent.tokens.toLocaleString()} tokens</span>

                  </div>

                  <button
                    onClick={() => setActiveLaunchAgent(agent)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f2eee6] hover:bg-[#ede9e0] text-[#282820] text-xs font-medium transition-colors"
                  >
                    <span>Run Prompt</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Recent Activity */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#282820] tracking-tight">
            Recent Activity
          </h2>

          <div className="space-y-3.5">
            {visibleActivities.length === 0 && (
              <p className="p-5 rounded-2xl border border-[#e7e2d9] text-sm text-[#665f54]">
                {activities.length ? 'No activity matches your search.' : 'Model connections and prompt runs will appear here.'}
              </p>
            )}
            {visibleActivities.map(act => {
              const isRun = /blue|2f5d8a/i.test(act.tagColorClass) || act.title.endsWith('Live Run');
              const open = selectedActivity === act.id;
              return (
                <div key={act.id} className="workspace-card overflow-hidden">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setSelectedActivity(open ? null : act.id)}
                    className="block w-full space-y-3 p-5 text-left transition hover:bg-[#f8f5ef] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#08666c]"
                  >
                    <span className="flex items-center justify-between gap-3 text-xs">
                      <span className={`inline-flex items-center gap-1.5 font-medium ${isRun ? 'text-[#2f5d8a]' : 'text-[#1f6b5f]'}`}>
                        <span aria-hidden="true" className={`size-1.5 rounded-full ${isRun ? 'bg-[#2f5d8a]' : 'bg-[#08666c]'}`} />
                        {isRun ? 'Prompt run' : 'Connection'}
                      </span>
                      <time className="text-[#777064]" dateTime={act.createdAt}>{formatWhen(act.createdAt, act.date)}</time>
                    </span>
                    <span className="block">
                      <span className="block text-base font-semibold tracking-tight text-[#282820]">{act.title}</span>
                      <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-[#665f54]">{act.snippet}</span>
                    </span>
                    <span className="flex items-center justify-between gap-3 pt-1">
                      <span className="rounded-full border border-[#d8d3ca] bg-[#f2eee6] px-2.5 py-0.5 text-xs font-medium text-[#4b4941]">{act.modelTag}</span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#08666c]">
                        {open ? 'Hide response' : 'View response'}
                        <ChevronDown aria-hidden="true" className={`size-3.5 transition ${open ? 'rotate-180' : ''}`} />
                      </span>
                    </span>
                  </button>
                  {open && (
                    <div className="border-t border-[#e7e2d9] bg-[#faf8f4] px-5 py-4">
                      <div className="max-h-[28rem] overflow-y-auto pr-1"><Markdown size="sm">{act.response}</Markdown></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
