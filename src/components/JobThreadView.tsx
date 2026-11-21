import { useEffect, useRef, useState } from 'react';
import { submitOnEnter } from '../lib/submitOnEnter';
import { ArrowLeft, ArrowUp, Bot, Check, CircleAlert, LoaderCircle, Pause, Play } from 'lucide-react';
import { useNeuro, type NeuroJob } from '../context/NeuroContext';
import { JobStatus, jobStatusLabels } from './TimelineView';
import { AssistantMessage, UserMessage, WorkingMessage } from './ChatMessage';
import type { AgentStep } from '../lib/agentSteps';

export function JobThreadView({ job, startOnOpen, onBack }: { job: NeuroJob; startOnOpen: boolean; onBack: () => void }) {
  const { agents, assignJob, sendJobMessage, updateJobStatus, refreshWorkspace } = useNeuro();
  const [draft, setDraft] = useState('');
  const [assignee, setAssignee] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [liveSteps, setLiveSteps] = useState<AgentStep[]>([]);
  const [serverRunning, setServerRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const autoStarted = useRef(false);
  const working = busy || serverRunning;
  const conversation = job.logs.filter(entry => entry.role);
  const activity = job.logs.filter(entry => !entry.role);
  const agent = job.assignedType === 'agent' ? agents.find(entry => entry.id === job.assignedToId && entry.endpointUrl) : undefined;
  const canRun = Boolean(agent) && job.status !== 'paused';
  const hasReply = conversation.some(entry => entry.role === 'agent');
  const status = busy ? 'in_progress' : job.status;
  const stage = status === 'completed' ? 2 : status === 'queued' ? 0 : 1;
  const jobTime = Date.parse(job.createdAt);

  async function send(message?: string) {
    setBusy(true);
    setError('');
    try {
      await sendJobMessage(job.id, message);
      if (message) setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run the job.');
    } finally {
      setBusy(false);
    }
  }

  // Live steps: poll while a reply runs here, and once on open in case one is already running.
  useEffect(() => {
    let cancelled = false;
    let wasRunning = false;
    const started = Date.now();
    setSeconds(0);
    async function poll() {
      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(job.id)}/progress`);
        if (!res.ok || cancelled) return;
        const data = await res.json() as { running: boolean; steps: AgentStep[] };
        if (cancelled) return;
        setLiveSteps(data.steps);
        setServerRunning(data.running);
        if (data.running) wasRunning = true;
        // A run started elsewhere just finished: load its reply.
        else if (wasRunning && !busy) { wasRunning = false; void refreshWorkspace(); }
      } catch { /* keep the last steps */ }
    }
    void poll();
    if (!working) return () => { cancelled = true; };
    const timer = window.setInterval(() => { void poll(); setSeconds(Math.round((Date.now() - started) / 1000)); }, 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [job.id, working]);

  useEffect(() => {
    if (startOnOpen && agent && !autoStarted.current) {
      autoStarted.current = true;
      void send();
    }
  }, [startOnOpen, agent]);

  async function changeStatus(next: NeuroJob['status']) {
    setError('');
    try {
      await updateJobStatus(job.id, next);
    } catch {
      setError('Could not update the job status.');
    }
  }

  async function assign() {
    const selected = agents.find(entry => entry.id === assignee);
    if (!selected) return;
    setError('');
    try {
      await assignJob(job.id, 'agent', selected.id, selected.name);
    } catch {
      setError('Could not assign the agent.');
    }
  }

  return (
    <div className="mx-auto max-w-[820px] space-y-6">
      <button type="button" onClick={onBack} className="workspace-button"><ArrowLeft aria-hidden="true" className="size-4" /> Timeline</button>
      <header className="space-y-3 border-b border-[#e7e2d9] pb-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e9f0ea] text-[#256457]"><Bot aria-hidden="true" className="size-4" /></span>
          <span className="font-medium">{agent?.name || job.assignedToName || 'Unassigned'}</span>
          <span className="text-xs text-[#665f54]">{job.category}{Number.isFinite(jobTime) ? ` · ${new Date(jobTime).toLocaleString()}` : ''}</span>
          <div className="ml-auto"><JobStatus status={status} /></div>
        </div>
        <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-4xl">{job.title}</h1>
        <ol aria-label="Progress" className="flex flex-wrap gap-2">
          {['Queued', 'Agent run', 'Finished'].map((label, index) => <li key={label}
            aria-current={index === stage ? 'step' : undefined}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${index === stage ? 'border-[#08666c] bg-[#e9f2ed] font-semibold text-[#08666c]' : 'border-[#e0dace] text-[#665f54]'}`}>
            {index < stage && <Check aria-hidden="true" className="size-3" />}{label}
          </li>)}
        </ol>
      </header>

      <section aria-label="Job conversation" aria-live="polite" className="space-y-7">
        {job.description && <UserMessage text={job.description} attachments={job.attachments} />}
        {conversation.map((entry, index) => entry.role === 'user'
          ? <UserMessage key={index} text={entry.message} time={entry.timestamp} />
          : <AssistantMessage key={index} name={entry.author || agent?.name || 'Agent'} text={entry.message} time={entry.timestamp} steps={entry.steps} />)}
        {!hasReply && job.outputSummary && <AssistantMessage name={agent?.name || job.assignedToName || 'Agent'} text={job.outputSummary} />}
        {working && <WorkingMessage name={agent?.name || 'Agent'} steps={liveSteps} seconds={seconds} />}
        {activity.length > 0 && (
          <details className="workspace-card p-3.5 text-sm">
            <summary className="cursor-pointer font-medium text-[#4b4941]">Job activity · {activity.length}</summary>
            <ul className="mt-3 space-y-2 border-l border-[#e7e2d9] pl-3 text-xs text-[#665f54]">
              {activity.map((entry, index) => <li key={index}>{entry.message}</li>)}
            </ul>
          </details>
        )}
        {!agent && (
          <div className="workspace-card space-y-2 border-[#e6d8c9] bg-[#fbf4e9] p-3.5">
            <p className="flex items-center gap-2 text-sm"><CircleAlert aria-hidden="true" className="size-4" /> Assign a connected agent to run this job.</p>
            {agents.some(entry => entry.endpointUrl) && <div className="flex flex-wrap gap-2">
              <select aria-label="Assign agent" className="workspace-input max-w-full" value={assignee} onChange={event => setAssignee(event.target.value)}>
                <option value="">Select agent</option>
                {agents.filter(entry => entry.endpointUrl).map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
              </select>
              <button type="button" disabled={!assignee} onClick={() => void assign()} className="workspace-button">Assign</button>
            </div>}
          </div>
        )}
        {status === 'paused' && <p className="rounded-xl bg-[#f7eed7] px-3 py-2 text-sm text-[#6d551d]">This job is paused. Resume it to continue.</p>}
      </section>

      <form className="sticky bottom-3 z-10 space-y-2 rounded-3xl border border-[#d8d3ca] bg-[#fffdfa] p-3 shadow-[0_8px_30px_#26251e14] transition focus-within:border-[#8bb6ae] focus-within:ring-4 focus-within:ring-[#e7efe7] sm:bottom-5" onSubmit={event => { event.preventDefault(); if (canRun && !busy && draft.trim()) void send(draft.trim()); }}>
        <label htmlFor="job-reply" className="sr-only">Reply to agent</label>
        <textarea id="job-reply" rows={2} maxLength={8000} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={submitOnEnter} disabled={!canRun}
          placeholder={agent ? `Reply to ${agent.name}…` : 'Assign an agent to send a reply'} className="block max-h-60 min-h-12 w-full resize-none bg-transparent px-2 pt-1 text-[15px] leading-6 outline-none placeholder:text-[#8a8478] disabled:opacity-60 [field-sizing:content]" />
        {error && <p role="alert" className="px-2 text-sm text-[#922d1d]">{error}</p>}
        <div className="flex flex-wrap items-center gap-2 pl-2">
          <span className="text-xs text-[#8a8478]">{working ? 'The agent is working…' : <><span className="hidden sm:inline">Enter to send · Shift+Enter for a new line · </span>{jobStatusLabels[job.status]}</>}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {canRun && !busy && !conversation.length && job.status !== 'completed' &&
              <button type="button" className="workspace-button" onClick={() => void send()}><Play aria-hidden="true" className="size-4" /> {job.status === 'failed' ? 'Retry job' : 'Run job'}</button>}
            {job.status === 'paused' ? <button type="button" className="workspace-button" onClick={() => void changeStatus(agent ? 'in_progress' : 'queued')}><Play aria-hidden="true" className="size-4" /> Resume</button> :
              !busy && (job.status === 'queued' || job.status === 'in_progress') && <button type="button" className="workspace-button" onClick={() => void changeStatus('paused')}><Pause aria-hidden="true" className="size-4" /> Pause job</button>}
            <button type="submit" disabled={!canRun || working || !draft.trim()} aria-label="Send reply" title="Send reply"
              className="grid size-9 place-items-center rounded-full bg-[#262922] text-white transition hover:bg-[#3b4236] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08666c] disabled:cursor-not-allowed disabled:bg-[#d8d3ca]">
              {working ? <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" /> : <ArrowUp aria-hidden="true" className="size-4" />}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
