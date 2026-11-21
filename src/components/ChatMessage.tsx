import { useState, type ReactNode } from 'react';
import { MessageAttachments } from './MessageAttachments';
import type { JobAttachment } from '../lib/attachments';
import { Bot, Check, Copy } from 'lucide-react';
import { Markdown, copyText } from './Markdown';
import { AgentSteps } from './AgentSteps';
import type { AgentStep } from '../lib/agentSteps';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/** Shows ISO timestamps as a local time; passes short labels (e.g. "11:50 PM") through. */
export function formatMessageTime(value?: string) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : timeFormat.format(time);
}

function Avatar() {
  return (
    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-[#08666c] text-white shadow-sm shadow-[#08666c]/20">
      <Bot className="size-4" />
    </span>
  );
}

/** The person's own message: a soft bubble on the right. */
export function UserMessage({ text, time: rawTime, attachments }: { text: string; time?: string; attachments?: JobAttachment[] }) {
  const time = formatMessageTime(rawTime);
  return (
    <div className="group flex flex-col items-end gap-1.5">
      {attachments && attachments.length > 0 && <MessageAttachments attachments={attachments} />}
      <div className="max-w-[88%] rounded-3xl rounded-br-lg bg-[#ebe7de] px-4 py-2.5 text-[15px] leading-7 whitespace-pre-wrap text-[#282820] [overflow-wrap:anywhere] sm:max-w-[75%]">
        {text}
      </div>
      {time && <span className="px-2 text-xs text-[#a9a397] opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">{time}</span>}
    </div>
  );
}

/** An agent reply: avatar and name, then full-width Markdown with a copy action. */
export function AssistantMessage({ name, text, time: rawTime, steps, children }: { name: string; text: string; time?: string; steps?: AgentStep[]; children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const time = formatMessageTime(rawTime);
  return (
    <article aria-label={`${name} reply`} className="group flex gap-3 sm:gap-4">
      <Avatar />
      <div className="min-w-0 flex-1 pt-1">
        <header className="mb-1.5 flex items-baseline gap-2">
          <span className="text-sm font-semibold text-[#282820]">{name}</span>
          {time && <span className="text-xs text-[#a9a397]">{time}</span>}
        </header>
        {steps && steps.length > 0 && <AgentSteps steps={steps} />}
        <Markdown>{text}</Markdown>
        {children}
        <div className="mt-2 flex items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <button type="button" onClick={async () => { if (await copyText(text)) { setCopied(true); window.setTimeout(() => setCopied(false), 1500); } }}
            aria-label={copied ? 'Copied' : 'Copy reply'}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[#665f54] transition hover:bg-[#ede9e0] hover:text-[#282820] focus-visible:outline-2 focus-visible:outline-[#08666c]">
            {copied ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </article>
  );
}

/** A reply in progress: avatar, name, and the live step timeline. */
export function WorkingMessage({ name, steps, seconds }: { name: string; steps: AgentStep[]; seconds?: number }) {
  return (
    <div className="flex gap-3 sm:gap-4">
      <Avatar />
      <div className="min-w-0 flex-1 pt-1">
        <span className="mb-2 block text-sm font-semibold text-[#282820]">{name}</span>
        <AgentSteps steps={steps} live seconds={seconds} />
      </div>
    </div>
  );
}

/** Shown while the agent is working. */
export function TypingIndicator({ name, label = 'Thinking' }: { name: string; label?: string }) {
  return (
    <div role="status" className="flex gap-3 sm:gap-4">
      <Avatar />
      <div className="pt-1">
        <span className="text-sm font-semibold text-[#282820]">{name}</span>
        <p className="mt-1.5 flex items-center gap-2 text-sm text-[#665f54]">
          <span aria-hidden="true" className="flex gap-1">
            {[0, 150, 300].map(delay => (
              <span key={delay} className="size-1.5 rounded-full bg-[#08666c]/70 motion-safe:animate-bounce" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </span>
          {label}…
        </p>
      </div>
    </div>
  );
}
