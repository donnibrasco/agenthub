import { useEffect, useState } from 'react';
import { ChevronDown, FileSearch, Globe, Link2, ListChecks, FileText, Wrench } from 'lucide-react';
import type { AgentStep } from '../lib/agentSteps';
import { Markdown } from './Markdown';

const LIVE_WORDS = ['Thinking', 'Researching', 'Reasoning', 'Philosophizing', 'Pondering', 'Working', 'Synthesizing'];

function Dot({ tone, pulse = false }: { tone: 'muted' | 'ok' | 'bad' | 'accent'; pulse?: boolean }) {
  const color = { muted: 'bg-[#b9b3a7]', ok: 'bg-[#3f9a6e]', bad: 'bg-[#c4513a]', accent: 'bg-[#08666c]' }[tone];
  return (
    <span aria-hidden="true" className="absolute top-[7px] -left-[21px] grid size-2.5 place-items-center">
      {pulse && <span className={`absolute size-2.5 rounded-full ${color} opacity-60 motion-safe:animate-ping`} />}
      <span className={`relative size-2.5 rounded-full ${color} ring-4 ring-[#faf8f4]`} />
    </span>
  );
}

function isSandboxBlock(output: string) {
  return /bwrap:|unprivileged_userns|Operation not permitted.*namespace/i.test(output);
}

function CommandStep({ step }: { step: Extract<AgentStep, { kind: 'command' }> }) {
  const blocked = step.status === 'failed' && isSandboxBlock(step.output);
  const tone = step.status === 'running' ? 'accent' : step.status === 'done' ? 'ok' : blocked ? 'muted' : 'bad';
  return (
    <li className="relative">
      <Dot tone={tone} pulse={step.status === 'running'} />
      <p className="text-sm text-[#665f54]">
        <span className="font-semibold text-[#282820]">{step.status === 'running' ? 'Running' : 'Ran'}</span>{' '}
        {blocked ? <span>· blocked on this server</span> : step.status === 'failed' && step.exitCode !== null ? <span className="text-[#922d1d]">· exit {step.exitCode}</span> : null}
      </p>
      <div className="mt-2 overflow-hidden rounded-xl border border-[#e7e2d9] bg-[#fffdfa] font-mono text-[12.5px] leading-relaxed">
        <div className="flex gap-3 px-3.5 py-2.5">
          <span className="w-7 shrink-0 select-none text-[11px] font-medium text-[#a9a397]">IN</span>
          <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap text-[#282820] [overflow-wrap:anywhere]">{step.command}</pre>
        </div>
        {(step.output || step.status !== 'running') && (
          <div className="flex gap-3 border-t border-[#efebe3] bg-[#f6f3ed] px-3.5 py-2.5">
            <span className="w-7 shrink-0 select-none text-[11px] font-medium text-[#a9a397]">OUT</span>
            <pre className="max-h-48 min-w-0 flex-1 overflow-auto whitespace-pre-wrap text-[#4b4941] [overflow-wrap:anywhere]">
              {blocked ? 'Commands are disabled for agents on this server.' : step.output || '(no output)'}
            </pre>
          </div>
        )}
      </div>
    </li>
  );
}

function ThinkingStep({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 280;
  return (
    <li className="relative">
      <Dot tone="muted" />
      <p className="text-sm font-semibold text-[#8a8478]">Thinking</p>
      <div className={`mt-1 text-[#665f54] ${long && !open ? 'line-clamp-3' : ''}`}>
        <Markdown size="sm" className="!text-[#665f54] [&_strong]:!text-[#4b4941]">{text}</Markdown>
      </div>
      {long && (
        <button type="button" onClick={() => setOpen(v => !v)} className="mt-1 text-xs font-medium text-[#08666c] hover:underline">
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </li>
  );
}

function Step({ step }: { step: AgentStep }) {
  switch (step.kind) {
    case 'thinking': return <ThinkingStep text={step.text} />;
    case 'message':
      return (
        <li className="relative">
          <Dot tone="muted" />
          <Markdown size="sm">{step.text}</Markdown>
        </li>
      );
    case 'search':
      return (
        <li className="relative">
          <Dot tone="ok" />
          <p className="flex items-start gap-1.5 text-sm text-[#665f54]">
            <Globe aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-[#8a8478]" />
            <span><span className="font-semibold text-[#282820]">Searched the web</span>{step.query ? <> · <span className="text-[#4b4941]">{step.query}</span></> : null}</span>
          </p>
        </li>
      );
    case 'command': return <CommandStep step={step} />;
    case 'plan':
      return (
        <li className="relative">
          <Dot tone="accent" />
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[#282820]"><ListChecks aria-hidden="true" className="size-3.5 text-[#8a8478]" /> Plan</p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {step.items.map((item, i) => (
              <li key={i} className={`flex gap-2 ${item.completed ? 'text-[#8a8478] line-through' : 'text-[#4b4941]'}`}>
                <span aria-hidden="true">{item.completed ? '☑' : '☐'}</span>{item.text}
              </li>
            ))}
          </ul>
        </li>
      );
    case 'fetch':
      return (
        <li className="relative">
          <Dot tone={step.failed ? 'bad' : 'ok'} />
          <p className="flex items-start gap-1.5 text-sm text-[#665f54]">
            <Link2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-[#8a8478]" />
            <span className="min-w-0 [overflow-wrap:anywhere]"><span className="font-semibold text-[#282820]">{step.failed ? 'Could not read page' : 'Read web page'}</span> · <span className="text-[#4b4941]">{step.url.replace(/^https?:\/\//, '')}</span></span>
          </p>
        </li>
      );
    case 'read':
      return (
        <li className="relative">
          <Dot tone={step.failed ? 'bad' : 'ok'} />
          <p className="flex items-start gap-1.5 text-sm text-[#665f54]">
            <FileSearch aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-[#8a8478]" />
            <span className="min-w-0 [overflow-wrap:anywhere]"><span className="font-semibold text-[#282820]">{step.failed ? 'Could not open' : 'Opened'}</span> · <span className="text-[#4b4941]">{step.path}</span></span>
          </p>
        </li>
      );
    case 'tool':
      return (
        <li className="relative">
          <Dot tone={step.failed ? 'bad' : 'muted'} />
          <p className="flex items-start gap-1.5 text-sm text-[#665f54]">
            <Wrench aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-[#8a8478]" />
            <span className="min-w-0 [overflow-wrap:anywhere]"><span className="font-semibold text-[#282820]">{step.name}</span>{step.detail ? <> · <span className="text-[#4b4941]">{step.detail}</span></> : null}</span>
          </p>
        </li>
      );
    case 'files':
      return (
        <li className="relative">
          <Dot tone="accent" />
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[#282820]"><FileText aria-hidden="true" className="size-3.5 text-[#8a8478]" /> Edited files</p>
          <ul className="mt-1 space-y-0.5 font-mono text-xs text-[#4b4941]">{step.paths.map(p => <li key={p}>{p}</li>)}</ul>
        </li>
      );
  }
}

/** A "✻ Philosophizing…" status line whose verb changes while the agent works. */
export function LiveStatus({ seconds }: { seconds?: number }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex(i => (i + 1) % LIVE_WORDS.length), 2600);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <p role="status" className="flex items-center gap-2 text-sm font-medium text-[#08666c]">
      <span aria-hidden="true" className="inline-block text-base leading-none text-[#c46a3a] motion-safe:animate-spin [animation-duration:3s]">✻</span>
      <span>{LIVE_WORDS[index]}…</span>
      {seconds !== undefined && <span className="font-normal text-[#a9a397] tabular-nums">{seconds}s</span>}
    </p>
  );
}

function summarize(steps: AgentStep[]) {
  const n = (kind: AgentStep['kind']) => steps.filter(s => s.kind === kind).length;
  const parts = [
    n('thinking') && 'thought it through',
    n('search') && `searched the web ${n('search') === 1 ? 'once' : `${n('search')} times`}`,
    n('fetch') && `read ${n('fetch')} page${n('fetch') === 1 ? '' : 's'}`,
    n('read') && `opened ${n('read')} file${n('read') === 1 ? '' : 's'}`,
    n('command') && `ran ${n('command')} command${n('command') === 1 ? '' : 's'}`,
  ].filter(Boolean) as string[];
  const text = parts.join(', ') || `${steps.length} step${steps.length === 1 ? '' : 's'}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The agent's work as a vertical timeline (thinking, searches, commands, notes). */
export function AgentSteps({ steps, live = false, seconds }: { steps: AgentStep[]; live?: boolean; seconds?: number }) {
  const [open, setOpen] = useState(true);
  if (!steps.length && !live) return null;
  return (
    <div className="mb-4">
      {!live && (
        <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
          className="mb-2 inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 -ml-1.5 text-xs font-medium text-[#8a8478] transition hover:bg-[#ede9e0] hover:text-[#4b4941]">
          {summarize(steps)}
          <ChevronDown aria-hidden="true" className={`size-3.5 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
      {(open || live) && (
        <ol className="ml-[5px] space-y-4 border-l border-[#e2ddd3] pl-4" aria-label="Agent steps">
          {steps.map((step, i) => <Step key={i} step={step} />)}
          {live && (
            <li className="relative">
              <span aria-hidden="true" className="absolute top-[6px] -left-[21px] size-2.5 rounded-full bg-[#faf8f4]" />
              <LiveStatus seconds={seconds} />
            </li>
          )}
        </ol>
      )}
    </div>
  );
}
