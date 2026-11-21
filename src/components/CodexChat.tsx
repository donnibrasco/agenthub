import { useEffect, useRef, useState } from 'react';
import { AssistantMessage, TypingIndicator, UserMessage } from './ChatMessage';
import { Markdown } from './Markdown';
import { submitOnEnter } from '../lib/submitOnEnter';
import { ArrowLeft, ArrowUp, Bot, ChevronRight, KeyRound, LoaderCircle, Plus, Settings2, Square } from 'lucide-react';
import { useNeuro } from '../context/NeuroContext';
import { CODEX_HISTORY_LIMIT, CODEX_MESSAGE_LIMIT, readEventData, type CodexAction, type CodexEvent, type CodexReply, type CodexSettings, type CodexTurn } from '../lib/codexChat';

type ChatMessage = CodexTurn & { actions?: CodexAction[] };

const suggestions = ['Which models are connected?', 'Help me connect a model', 'Show my workspace jobs'];
const iconButton = 'grid size-8 shrink-0 place-items-center rounded-lg text-[#665f54] transition hover:bg-[#ede9e0] hover:text-[#282820] focus-visible:outline-2 focus-visible:outline-[#08666c] disabled:opacity-40';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#262922] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#3b4236] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08666c] disabled:opacity-45 disabled:hover:bg-[#262922]';

class CodexRequestError extends Error {
  constructor(message: string, readonly openSettings?: boolean) {
    super(message);
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    window.location.replace('/login');
    throw new Error('Your session expired. Sign in again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new CodexRequestError(data?.error || 'AgentHub could not complete the request. Try again.', data?.openSettings === true);
  }
  return data as T;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  return readResponse<T>(await fetch(url, init));
}

function json(method: string, data: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}

function chatError(error: unknown) {
  return error instanceof Error ? error : new Error('Something went wrong. Try again.');
}

export function CodexChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { agents, jobs, refreshWorkspace, setEditingModel, setIsConnectModalOpen, setActiveTab, setActiveJobDetails } = useNeuro();
  const [settings, setSettings] = useState<CodexSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState('');
  const [phase, setPhase] = useState('');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<CodexAction | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectedIds, setDisconnectedIds] = useState<string[]>([]);
  const backRef = useRef<HTMLButtonElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const followBottom = useRef(true);
  const busy = Boolean(pending);
  const showSettings = settingsOpen || settings?.configured === false;

  function close() {
    setApiKey('');
    setSettingsOpen(false);
    onClose();
  }

  function resetChat() {
    setMessages([]);
    setDraft('');
    setError(null);
    setConfirmDisconnect(null);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void request<CodexSettings>('/api/codex/settings').then(value => {
      if (!cancelled) setSettings(value);
    }).catch(error => {
      if (!cancelled) setError(chatError(error));
    });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (open) (keyRef.current ?? textareaRef.current ?? backRef.current)?.focus({ preventScroll: true });
  }, [open, showSettings, settings?.configured]);

  useEffect(() => {
    if (open && historyRef.current && followBottom.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [open, messages, pending, phase, preview, confirmDisconnect]);

  async function updateSettings(key?: string) {
    setSettingsBusy(true);
    setError(null);
    try {
      const result = await request<CodexSettings>('/api/codex/settings', key ? json('PUT', { apiKey: key }) : { method: 'DELETE' });
      setSettings(result);
      setApiKey('');
      setSettingsOpen(false);
    } catch (error) {
      setError(chatError(error));
    } finally {
      setSettingsBusy(false);
    }
  }

  async function send(input: string) {
    const message = input.trim();
    if (!message || activeRequest.current || !settings?.configured) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    followBottom.current = true;
    setPending(message);
    setPhase('Connecting…');
    setPreview('');
    setDraft('');
    setError(null);
    try {
      const history = messages.slice(-CODEX_HISTORY_LIMIT).map(({ role, content }) => ({ role, content }));
      const response = await fetch('/api/codex/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ message, history }), signal: controller.signal,
      });
      let reply: CodexReply | undefined;
      if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
        reply = await readResponse<CodexReply>(response);
      } else {
        for await (const line of readEventData(response.body)) {
          const event = JSON.parse(line) as CodexEvent;
          if (event.type === 'status') { setPhase(event.label); setPreview(''); }
          if (event.type === 'delta') setPreview(text => text + event.text);
          if (event.type === 'error') throw new CodexRequestError(event.message, event.openSettings);
          if (event.type === 'done') { reply = event.reply; break; }
        }
      }
      if (!reply) throw new Error('The reply was interrupted. Refresh the workspace before retrying actions.');
      const { message: answer, actions, workspaceChanged } = reply;
      setMessages(previous => [...previous, { role: 'user', content: message }, { role: 'assistant', content: answer, actions }]);
      if (workspaceChanged) await refreshWorkspace();
    } catch (error) {
      if (controller.signal.aborted) {
        setMessages(previous => [...previous, { role: 'user', content: message }, { role: 'assistant', content: 'Stopped. Any completed actions remain in the workspace.' }]);
        await refreshWorkspace();
      } else {
        setError(chatError(error));
        setDraft(current => current || message);
      }
    } finally {
      activeRequest.current = null;
      setPending('');
      setPhase('');
      setPreview('');
    }
  }

  function openAction(action: CodexAction) {
    if (action.kind === 'model') {
      const model = agents.find(entry => entry.id === action.id);
      setActiveTab('agents');
      if (model) {
        setEditingModel(model);
        setIsConnectModalOpen(true);
      }
      close();
    } else if (action.kind === 'job') {
      setActiveTab('jobs');
      setActiveJobDetails(jobs.find(entry => entry.id === action.id) ?? null);
      close();
    } else {
      setConfirmDisconnect(action);
    }
  }

  async function disconnect(action: CodexAction) {
    setDisconnecting(true);
    setError(null);
    try {
      await request(`/api/models/${encodeURIComponent(action.id)}`, { method: 'DELETE' });
      setDisconnectedIds(previous => [...previous, action.id]);
      setConfirmDisconnect(null);
      setMessages(previous => [...previous, { role: 'assistant', content: `Disconnected ${action.summary.replace(/^Disconnect /, '')}.` }]);
      await refreshWorkspace();
    } catch (error) {
      setError(chatError(error));
    } finally {
      setDisconnecting(false);
    }
  }

  if (!open) return null;

  const visibleMessages = pending ? [...messages, { role: 'user' as const, content: pending }] : messages;
  const isEmpty = visibleMessages.length === 0;
  const canChat = Boolean(settings?.configured) && !showSettings;
  const errorNotice = error && (
    <div className="rounded-xl border border-[#a44e32]/25 bg-[#f9ece4] p-3 text-sm text-[#922d1d]">
      <p role="alert">{error.message}</p>
      {!showSettings && error instanceof CodexRequestError && error.openSettings && (
        <button type="button" className="mt-2 font-semibold underline underline-offset-4" onClick={() => { setSettingsOpen(true); setApiKey(''); setError(null); }}>
          Open Codex settings
        </button>
      )}
    </div>
  );

  return (
    <section aria-labelledby="codex-chat-title" className="flex h-dvh min-h-0 flex-col bg-[#fffdfa] text-[#282820]"
      onKeyDown={event => { if (event.key === 'Escape' && !event.nativeEvent.isComposing) close(); }}>
      <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-[#e7e2d9] bg-[#fffdfa] px-3 py-3 sm:px-6">
        <button ref={backRef} type="button" onClick={close}
          className="inline-flex min-h-9 w-fit items-center gap-2 rounded-lg px-2 text-sm font-medium text-[#4b4941] transition hover:bg-[#ede9e0] hover:text-[#282820] focus-visible:outline-2 focus-visible:outline-[#08666c]">
          <ArrowLeft aria-hidden="true" className="size-4" /><span>Back</span>
        </button>
        <h1 id="codex-chat-title" className="text-sm font-semibold text-[#282820] sm:text-base">Agent chat</h1>
        <div className="flex items-center justify-end gap-1.5">
          <button type="button" className={iconButton} aria-label="New chat" title="New chat" disabled={busy || (!messages.length && !draft)}
            onClick={() => { resetChat(); textareaRef.current?.focus(); }}>
            <Plus aria-hidden="true" className="size-4" />
          </button>
          <button type="button" className={iconButton} aria-label="Codex settings" title="Codex settings" aria-pressed={showSettings}
            onClick={() => { setError(null); setApiKey(''); setSettingsOpen(!settingsOpen); }}>
            <Settings2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      </header>

      {showSettings ? (
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-10 sm:py-16">
          <div className="mx-auto max-w-lg space-y-4">
            <section className="rounded-2xl border border-[#d8d3ca] bg-[#fffdfa] p-5 sm:p-7">
              <KeyRound aria-hidden="true" className="mb-4 size-5 text-[#1f6b5f]" />
              <h2 className="text-lg font-semibold text-[#282820]">{settings?.configured ? 'OpenAI connection' : 'Connect Codex'}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#665f54]">
                {settings?.source === 'server' ? 'A key is configured on the server. You can save a workspace key here to use instead.' : settings?.configured ? 'Your workspace key is saved. Enter a new key to replace it.' : 'Add an OpenAI API key to chat with Codex about this workspace.'}
              </p>
              <form className="mt-5 space-y-3" onSubmit={event => { event.preventDefault(); if (apiKey.trim() && !settingsBusy) void updateSettings(apiKey.trim()); }}>
                <label className="block text-sm font-medium text-[#282820]" htmlFor="codex-api-key">OpenAI API key</label>
                <input ref={keyRef} id="codex-api-key" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={515}
                  value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="sk-…"
                  className="w-full rounded-lg border border-[#d8d3ca] bg-[#fffdfa] px-3 py-2.5 text-sm text-[#282820] outline-none focus:border-[#08666c]" />
                <div className="flex flex-wrap items-center gap-2">
                  <button type="submit" disabled={!apiKey.trim() || settingsBusy} className={primaryButton}>{settingsBusy ? 'Saving…' : 'Save key'}</button>
                  {settings?.source === 'workspace' && <button type="button" disabled={settingsBusy} onClick={() => void updateSettings()} className="px-2 py-2 text-sm text-[#665f54] hover:text-[#282820]">Remove key</button>}
                  {settings?.configured && <button type="button" onClick={() => { setSettingsOpen(false); setApiKey(''); setError(null); }} className="px-2 py-2 text-sm text-[#665f54] hover:text-[#282820]">Back to chat</button>}
                </div>
              </form>
              <a className="mt-4 inline-block text-xs font-medium text-[#1f6b5f] underline underline-offset-4" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">Get an OpenAI API key</a>
            </section>
            {errorNotice}
          </div>
        </main>
      ) : canChat ? (
        <main className={`flex min-h-0 flex-1 flex-col ${isEmpty ? 'overflow-y-auto' : ''}`}>
          <div className={`flex min-h-0 flex-col ${isEmpty ? 'my-auto py-8 sm:py-12' : 'flex-1'}`}>
            {isEmpty ? (
              <div className="mx-auto w-full max-w-3xl px-4 pb-6 text-center sm:px-6">
                <span className="mx-auto mb-5 grid size-12 place-items-center rounded-xl border border-[#166b66]/25 bg-[#e9f2eb] text-[#1f6b5f]"><Bot aria-hidden="true" className="size-6" /></span>
                <h2 className="text-2xl font-semibold tracking-tight text-[#282820] sm:text-4xl">Start a conversation</h2>
                <p className="mt-2 text-sm text-[#665f54]">Ask Codex about your agents, jobs, or workflows.</p>
              </div>
            ) : (
              <div ref={historyRef} onScroll={event => {
                const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
                followBottom.current = scrollHeight - scrollTop - clientHeight < 96;
              }} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-9">
                  <div className="space-y-7" role="log" aria-label="Conversation" aria-live="polite">
                    {visibleMessages.map((message, index) => message.role === 'user' ? <UserMessage key={index} text={message.content} /> : (
                      <AssistantMessage key={index} name="Codex" text={message.content}>
                        {message.actions?.map(action => (
                          <button key={`${action.kind}-${action.id}-${action.summary}`} type="button" disabled={action.kind === 'disconnect' && disconnectedIds.includes(action.id)} onClick={() => openAction(action)}
                            className="mt-2.5 flex w-full items-center justify-between gap-2 rounded-lg border border-[#e7e2d9] px-2.5 py-2 text-left text-xs text-[#1f6b5f] transition hover:bg-[#f2eee6] disabled:opacity-50">
                            <span className="min-w-0 [overflow-wrap:anywhere]">{action.summary}</span><ChevronRight aria-hidden="true" className="size-4 shrink-0" />
                          </button>
                        ))}
                      </AssistantMessage>
                    ))}
                  </div>
                  {busy && (preview ? (
                    <div className="mt-7 flex gap-3 sm:gap-4" aria-hidden="true">
                      <span className="size-8 shrink-0" />
                      <Markdown className="min-w-0 flex-1">{preview}</Markdown>
                    </div>
                  ) : <div className="mt-7"><TypingIndicator name="Codex" label={phase.replace(/…$/, '') || 'Thinking'} /></div>)}
                  {confirmDisconnect && (
                    <div className="mt-5 rounded-xl border border-[#a44e32]/25 bg-[#f9ece4] p-4 text-sm">
                      <p className="font-semibold text-[#922d1d]">{confirmDisconnect.summary}?</p>
                      <p className="mt-1 text-xs leading-relaxed text-[#4b4941]">This removes the connection and its saved credential from AgentHub.</p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" disabled={disconnecting} onClick={() => void disconnect(confirmDisconnect)} className="rounded-lg bg-[#f3d9cf] px-3 py-1.5 text-xs font-semibold text-[#922d1d] disabled:opacity-50">{disconnecting ? 'Disconnecting…' : 'Disconnect model'}</button>
                        <button type="button" disabled={disconnecting} onClick={() => setConfirmDisconnect(null)} className="px-2 text-xs text-[#4b4941] hover:text-[#282820]">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className={`mx-auto w-full max-w-3xl shrink-0 space-y-3 px-4 sm:px-6 ${isEmpty ? '' : 'pb-4 sm:pb-5'}`}>
              {errorNotice}
              <form className="rounded-xl border border-[#d8d3ca] bg-[#fffdfa] p-3 shadow-lg shadow-[#26251e]/10 focus-within:border-[#08666c]/60"
                onSubmit={event => { event.preventDefault(); void send(draft); }}>
                <textarea ref={textareaRef} aria-label="Message Codex" value={draft} onChange={event => setDraft(event.target.value)}
                  onKeyDown={submitOnEnter}
                  rows={isEmpty ? 3 : 2} maxLength={CODEX_MESSAGE_LIMIT} placeholder="What would you like to work on?"
                  className="block w-full resize-none bg-transparent px-1 py-1 text-base leading-6 text-[#282820] outline-none placeholder:text-[#665f54]" />
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#d8d3ca] pt-2">
                  <span className="inline-flex items-center gap-1.5 px-1 text-xs font-medium text-[#4b4941]"><Bot aria-hidden="true" className="size-4 text-[#1f6b5f]" /> Codex</span>
                  {busy ? (
                    <button type="button" aria-label="Stop reply" title="Stop reply" onClick={() => activeRequest.current?.abort()} className={`${primaryButton} size-9 shrink-0 p-0`}><Square aria-hidden="true" className="size-3.5 fill-current" /></button>
                  ) : <button type="submit" aria-label="Send message" title="Send message" disabled={!draft.trim()} className={`${primaryButton} size-9 shrink-0 p-0`}><ArrowUp aria-hidden="true" className="size-4.5" /></button>}
                </div>
              </form>
              {isEmpty && (
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestions.map(suggestion => <button key={suggestion} type="button" onClick={() => void send(suggestion)}
                    className="rounded-lg border border-[#d8d3ca] px-2.5 py-1.5 text-xs text-[#4b4941] transition hover:border-[#166b66]/25 hover:text-[#1f6b5f] focus-visible:outline-2 focus-visible:outline-[#08666c]">
                    {suggestion}
                  </button>)}
                </div>
              )}
            </div>
          </div>
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4">
          {errorNotice ?? <p role="status" className="flex items-center justify-center gap-2 text-sm text-[#665f54]"><LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" /> Loading Codex…</p>}
        </main>
      )}

      <footer className="shrink-0 border-t border-[#e7e2d9] px-4 py-3 text-xs text-[#665f54] sm:px-6">by AgenticProcess</footer>
    </section>
  );
}
