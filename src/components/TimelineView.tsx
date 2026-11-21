import { useState, type MouseEventHandler } from 'react';
import { ArrowRight, Bot, CircleAlert, ListTodo, MessageSquare, Plus } from 'lucide-react';
import { useNeuro, type NeuroJob } from '../context/NeuroContext';

export const jobStatusLabels: Record<NeuroJob['status'], string> = {
  queued: 'Queued', in_progress: 'Working', completed: 'Finished', failed: 'Failed', paused: 'Paused',
};

const statusStyles: Record<NeuroJob['status'], string> = {
  queued: 'border-[#ded8ce] text-[#625e55]',
  in_progress: 'border-[#166b66]/20 bg-[#e9f2eb] text-[#22574c]',
  completed: 'border-[#ded8ce] text-[#52594a]',
  failed: 'border-[#a44e32]/20 bg-[#f9ece4] text-[#8b4026]',
  paused: 'border-[#987529]/25 bg-[#f7eed7] text-[#6d551d]',
};

export function JobStatus({ status }: { status: NeuroJob['status'] }) {
  return <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}>{jobStatusLabels[status]}</span>;
}

function needsAttention(job: NeuroJob) {
  return job.status === 'failed' || job.status === 'paused';
}

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function TimelineView({ onNewChat, onOpenJob }: {
  onNewChat: MouseEventHandler<HTMLButtonElement>;
  onOpenJob: (jobId: string) => void;
}) {
  const { jobs, agents } = useNeuro();
  const [newest, setNewest] = useState(true);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [assignee, setAssignee] = useState('');
  const [search, setSearch] = useState('');
  const matching = search.trim().toLowerCase();
  const agentNames = new Map(agents.map(agent => [agent.id, agent.name]));
  const assignees = new Map(jobs.flatMap(job => job.assignedType === 'agent' && job.assignedToId
    ? [[job.assignedToId, agentNames.get(job.assignedToId) || job.assignedToName || 'Disconnected agent'] as const] : []));

  const rows = jobs.map((job, index) => ({ job, index, time: Date.parse(job.createdAt) || 0 }))
    .filter(({ job }) => (!attentionOnly || needsAttention(job)) && (!assignee || job.assignedToId === assignee)
      && (!matching || [job.title, job.description, job.assignedToName].some(value => value?.toLowerCase().includes(matching))))
    .sort((a, b) => (newest ? -1 : 1) * (a.time - b.time || a.index - b.index));

  const overview = [
    { title: 'Needs you', count: jobs.filter(needsAttention).length },
    { title: 'Working now', count: jobs.filter(job => job.status === 'in_progress').length },
    { title: 'Finished', count: jobs.filter(job => job.status === 'completed').length },
  ];
  let previousDay = '';

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Timeline</h1>
          <p className="mt-1.5 text-sm text-[#665f54] sm:text-base">Follow jobs across your connected agents.</p>
        </div>
        <button type="button" className="workspace-primary" onClick={onNewChat}><Plus aria-hidden="true" className="size-4" /> New chat</button>
      </header>

      <section aria-label="Overview" className="grid grid-cols-3 gap-2 sm:gap-3">
        {overview.map(({ title, count }, index) => index === 0 ? (
          <button type="button" key={title} aria-pressed={attentionOnly} onClick={() => setAttentionOnly(value => !value)}
            className="workspace-card flex min-w-0 flex-col items-start gap-1 px-2.5 py-3 text-left focus-visible:outline-2 focus-visible:outline-[#08666c] aria-pressed:border-[#08666c] aria-pressed:bg-[#e9f2ed] sm:px-4">
            <span className="text-xs font-medium text-[#216059]">{title}</span><span className="text-2xl tabular-nums">{count}</span>
          </button>
        ) : (
          <div key={title} className="workspace-card flex min-w-0 flex-col gap-1 px-2.5 py-3 sm:px-4">
            <span className="text-xs font-medium text-[#665f54]">{title}</span><span className="text-2xl tabular-nums">{count}</span>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-2 border-b border-[#e6e0d5] pb-3">
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search jobs" placeholder="Search jobs" className="workspace-input min-w-28 flex-1" />
        <select aria-label="Sort jobs" value={newest ? 'newest' : 'oldest'} onChange={event => setNewest(event.target.value === 'newest')} className="workspace-input">
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
        </select>
        <select aria-label="Filter by agent" value={assignee} onChange={event => setAssignee(event.target.value)} className="workspace-input max-w-full">
          <option value="">All agents</option>
          {Array.from(assignees, ([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>

      {rows.length === 0 && (
        <div className="workspace-card px-4 py-12 text-center">
          <ListTodo aria-hidden="true" className="mx-auto mb-3 size-6 text-[#08666c]" />
          <h2 className="font-semibold">{jobs.length ? 'No jobs match these filters' : 'No jobs yet'}</h2>
          <p className="mt-1 text-sm text-[#665f54]">{jobs.length ? 'Try a different search or clear a filter.' : 'Start a chat to create your first job.'}</p>
        </div>
      )}
      <div className="space-y-3">
        {rows.map(({ job, time }) => {
          const day = time ? dayFormat.format(time) : 'Earlier jobs';
          const showDay = day !== previousDay;
          previousDay = day;
          const name = (job.assignedToId && agentNames.get(job.assignedToId)) || job.assignedToName || 'Unassigned';
          const progress = Math.max(0, Math.min(100, job.progressPercent));
          const messageCount = job.logs.filter(log => log.role).length + Number(Boolean(job.description));
          return (
            <div key={job.id}>
              {showDay && <h2 className="mb-2.5 mt-4 flex items-center gap-3 px-1 text-xs font-medium text-[#665f54]">{day}<span className="h-px flex-1 bg-[#e6e0d5]" /></h2>}
              <article className="workspace-card space-y-3 p-3.5 sm:p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e9f0ea] text-[#256457]"><Bot aria-hidden="true" className="size-4" /></span>
                  <span className="break-words font-medium">{name}</span>
                  <span className="text-xs text-[#665f54]">{job.category}{time ? ` · ${timeFormat.format(time)}` : ''}</span>
                  <div className="ml-auto"><JobStatus status={job.status} /></div>
                </div>
                <button type="button" onClick={() => onOpenJob(job.id)} className="block w-fit break-words text-left text-lg font-semibold leading-snug hover:text-[#08666c] hover:underline">{job.title}</button>
                {(job.outputSummary || job.description) && <p className="line-clamp-2 text-sm leading-relaxed text-[#665f54] [overflow-wrap:anywhere]">{job.outputSummary || job.description}</p>}
                {job.status === 'in_progress' && progress > 0 && <div className="flex items-center gap-2 text-xs text-[#665f54]"><progress className="h-1.5 flex-1 accent-[#08666c]" max={100} value={progress} aria-label="Job progress" />{progress}%</div>}
                {needsAttention(job) && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e9ddd0] bg-[#f8f0e4] p-2 text-sm">
                  <CircleAlert aria-hidden="true" className="size-4 text-[#875630]" />
                  <span className="flex-1">{job.status === 'paused' ? 'This job is paused.' : 'The last run failed.'}</span>
                  <button type="button" onClick={() => onOpenJob(job.id)} className="workspace-button">Review</button>
                </div>}
                <button type="button" onClick={() => onOpenJob(job.id)} className="workspace-button">
                  <MessageSquare aria-hidden="true" className="size-3.5" /> {messageCount ? `${messageCount} ${messageCount === 1 ? 'message' : 'messages'}` : 'Open thread'} <ArrowRight aria-hidden="true" className="size-3.5" />
                </button>
              </article>
            </div>
          );
        })}
      </div>
    </div>
  );
}
