import { useRef, useState, type DragEvent, type FormEvent, type MouseEventHandler } from 'react';
import { submitOnEnter } from '../lib/submitOnEnter';
import { ArrowRight, Bot, Code2, FileText, ListChecks, MessageSquare, Paperclip, Search, Upload } from 'lucide-react';
import { AttachmentTray, useAttachments } from './AttachmentTray';
import { useNeuro, type NeuroJob } from '../context/NeuroContext';

const ideas = [
  { icon: Search, title: 'Research and compare', prompt: 'Compare the available options and summarize the trade-offs in a table.' },
  { icon: ListChecks, title: 'Build a checklist', prompt: 'Turn these notes into a prioritized checklist with owners and next steps.' },
  { icon: FileText, title: 'Draft outreach', prompt: 'Draft a short outreach message for me to review.' },
  { icon: Code2, title: 'Build a small tool', prompt: 'Design a small tool and explain how to implement it.' },
];
const categories: NeuroJob['category'][] = ['Engineering', 'Communication', 'Design', 'Search', 'DataOps'];

export function NewJobView({ onStarted, onAskCodex }: {
  onStarted: (id: string, run: boolean) => void;
  onAskCodex: MouseEventHandler<HTMLButtonElement>;
}) {
  const { agents, createJob, setIsConnectModalOpen, setEditingModel } = useNeuro();
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [category, setCategory] = useState<NeuroJob['category']>('Engineering');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const attachments = useAttachments();
  const hasContent = Boolean(draft.trim() || attachments.readyIds.length);
  const agent = agents.find(item => item.id === selected);
  const connected = agents.filter(item => item.endpointUrl);

  async function start(event: FormEvent) {
    event.preventDefault();
    if (!hasContent || busy || attachments.uploading) return;
    setBusy(true);
    setError('');
    try {
      const names = attachments.files.flatMap(item => (item.attachment ? [item.attachment.name] : []));
      const description = draft.trim() || 'Please review the attached files.';
      const headline = draft.trim() ? description.split('\n', 1)[0] : `Review ${names.length === 1 ? names[0] : `${names.length} attached files`}`;
      const title = headline.length > 90 ? `${headline.slice(0, 87)}…` : headline;
      const id = await createJob({
        title, description, category,
        assignedType: agent ? 'agent' : 'unassigned',
        assignedToId: agent?.id,
        assignedToName: agent?.name,
        attachmentIds: attachments.readyIds,
      });
      if (!id) throw new Error('Could not create the job. Try again.');
      attachments.clear();
      onStarted(id, Boolean(agent));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the job.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[720px] space-y-7 sm:py-12">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">What should the agent do?</h1>
        <p className="text-sm text-[#665f54] sm:text-base">Describe a job and follow its progress from your Timeline.</p>
      </header>
      <form onSubmit={event => void start(event)}
        onDragEnter={(event: DragEvent) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true); } }}
        onDragOver={(event: DragEvent) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }}
        onDragLeave={(event: DragEvent) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
        onDrop={(event: DragEvent) => { if (event.dataTransfer.files.length) { event.preventDefault(); attachments.add(event.dataTransfer.files); } setDragging(false); }}
        className="workspace-card relative space-y-5 border-[#8bb6ae] p-4 ring-4 ring-[#e7efe7] sm:p-5">
        {dragging && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl border-2 border-dashed border-[#08666c] bg-[#e9f2eb]/90">
            <p className="flex items-center gap-2 text-base font-medium text-[#08666c]"><Upload className="size-5" /> Drop files to attach</p>
          </div>
        )}
        <label className="sr-only" htmlFor="job-description">Job description</label>
        <textarea id="job-description" rows={4} maxLength={8000} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (attachments.readyIds.length && !draft.trim() && event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); return; } submitOnEnter(event); }}
          onPaste={event => { if (event.clipboardData.files.length) { event.preventDefault(); attachments.add(event.clipboardData.files); } }}
          placeholder="Describe the work you need done…" className="w-full resize-y rounded-lg bg-transparent p-2 text-base outline-none placeholder:text-[#777064] focus-visible:outline-[#08666c]" />
        <AttachmentTray files={attachments.files} onRemove={attachments.remove} />
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-[#665f54]">Who should do it?</legend>
          <div className="flex flex-wrap gap-2">
            {connected.map(item => (
              <label key={item.id} className="workspace-button cursor-pointer rounded-full has-[:checked]:border-[#08666c] has-[:checked]:bg-[#08666c] has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#08666c]">
                <input className="sr-only" type="radio" name="job-agent" value={item.id} checked={agent?.id === item.id} onChange={() => setSelected(item.id)} />
                <Bot aria-hidden="true" className="size-4" /> {item.name}
              </label>
            ))}
            <label className="workspace-button cursor-pointer rounded-full has-[:checked]:border-[#08666c] has-[:checked]:bg-[#e6efea] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#08666c]">
              <input className="sr-only" type="radio" name="job-agent" value="" checked={!agent} onChange={() => setSelected(null)} />
              Assign later
            </label>
          </div>
          {agent ? <p className="text-xs text-[#665f54]">{[agent.provider, agent.model].filter(Boolean).join(' · ')}</p> :
            <p className="text-xs text-[#665f54]">The job will be saved to your queue.</p>}
        </fieldset>
        {error && <p role="alert" className="text-sm text-[#922d1d]">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e7e2d9] pt-3">
          <input ref={fileInput} type="file" multiple hidden onChange={event => { if (event.target.files?.length) attachments.add(event.target.files); event.target.value = ''; }} />
          <button type="button" onClick={() => fileInput.current?.click()} aria-label="Attach files" title="Attach images, videos or files"
            className="grid size-10 place-items-center rounded-full border border-[#d8d3ca] text-[#4b4941] transition hover:bg-[#ede9e0] hover:text-[#282820] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08666c]">
            <Paperclip aria-hidden="true" className="size-4.5" />
          </button>
          <select aria-label="Job category" className="workspace-input" value={category} onChange={event => setCategory(event.target.value as NeuroJob['category'])}>
            {categories.map(option => <option key={option}>{option}</option>)}
          </select>
          <button type="submit" disabled={!hasContent || busy || attachments.uploading} className="workspace-primary ml-auto">
            {attachments.uploading ? 'Uploading…' : busy ? 'Creating…' : agent ? 'Start job' : 'Queue job'} <ArrowRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      </form>
      <section aria-label="Job ideas" className="grid gap-2 sm:grid-cols-2">
        {ideas.map(({ icon: Icon, title, prompt }) => <button key={title} type="button" onClick={() => setDraft(prompt)}
          className="workspace-card flex gap-3 p-3 text-left transition hover:border-[#8bb6ae] focus-visible:outline-2 focus-visible:outline-[#08666c]">
          <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#08666c]" />
          <span><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block text-xs leading-relaxed text-[#665f54]">{prompt}</span></span>
        </button>)}
      </section>
      <div className="flex flex-wrap justify-center gap-2">
        {!connected.length && <button type="button" className="workspace-button" onClick={() => { setEditingModel(null); setIsConnectModalOpen(true); }}>Connect an agent</button>}
        <button type="button" className="workspace-button" onClick={onAskCodex}><MessageSquare aria-hidden="true" className="size-4" /> Ask Codex</button>
      </div>
    </div>
  );
}
