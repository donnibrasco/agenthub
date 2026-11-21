import { Plug, GitBranch, LayoutGrid, LineChart, List, ListTodo, LogOut, Plus, Sparkles, UserRound } from 'lucide-react';
import { useNeuro, type ActiveTab } from '../context/NeuroContext';

const mainLinks = [
  { tab: 'timeline', label: 'Timeline', Icon: List },
  { tab: 'agents', label: 'Connections', Icon: Plug },
  { tab: 'jobs', label: 'Jobs & Tasks', Icon: ListTodo },
  { tab: 'workflows', label: 'Workflows', Icon: GitBranch },
  { tab: 'analytics', label: 'Usage', Icon: LineChart },
] as const;

const workspaceLinks = [
  { tab: 'dashboards', label: 'Dashboards', Icon: LayoutGrid },
  { tab: 'improvements', label: 'Improvements', Icon: Sparkles },
] as const;

export function NeuroSidebar({ onNavigate }: { onNavigate: (tab: ActiveTab) => void }) {
  const { activeTab } = useNeuro();

  function renderLink({ tab, label, Icon }: (typeof mainLinks | typeof workspaceLinks)[number]) {
    const active = activeTab === tab;
    const colors = active ? 'bg-[#08666c] text-white' : 'text-[#5c584d] hover:bg-[#ebe6dc]';
    return (
      <button key={tab} type="button" onClick={() => onNavigate(tab)} aria-current={active ? 'page' : undefined} title={label}
        className={`flex min-h-10 w-full items-center justify-center gap-2.5 rounded-lg px-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-[#26878b] sm:justify-start sm:px-3 ${colors}`}>
        <Icon aria-hidden="true" className="size-4 shrink-0" /><span className="sr-only sm:not-sr-only">{label}</span>
      </button>
    );
  }

  return (
    <aside className={`sticky top-0 flex h-dvh w-14 shrink-0 flex-col gap-6 overflow-y-auto border-r p-2 sm:w-48 sm:p-4 xl:w-60 border-[#e5dfd4] bg-[#f2eee6] text-[#282820]`}>
      <button type="button" onClick={() => onNavigate('timeline')} title="AgentHub"
        className="flex items-center justify-center gap-2.5 rounded-lg py-1 sm:justify-start sm:px-2">
        <span className={`grid size-7 shrink-0 place-items-center rounded-lg bg-[#08666c] text-white`}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 18L10 6L14 14L20 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <span className="sr-only text-base font-semibold tracking-tight sm:not-sr-only">AgentHub</span>
      </button>
      <nav aria-label="Workspace" className="space-y-5">
        <button type="button" onClick={() => onNavigate('new-chat')} title="New chat" aria-current={activeTab === 'new-chat' ? 'page' : undefined}
          className={`flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26878b] bg-[#262922] text-white hover:bg-[#3b4236]`}>
          <Plus aria-hidden="true" className="size-4 shrink-0" /><span className="sr-only sm:not-sr-only">New chat</span>
        </button>
        <div className="space-y-1">{mainLinks.map(renderLink)}</div>
        <div className={`space-y-1 border-t pt-3 border-[#e5dfd4]`}>{workspaceLinks.map(renderLink)}</div>
      </nav>
      <div className={`mt-auto border-t pt-3 border-[#e5dfd4]`}>
        <div className="flex items-center justify-center gap-2 py-1 sm:justify-start sm:px-2">
          <UserRound aria-hidden="true" className="size-4" /><span className="sr-only text-xs font-medium sm:not-sr-only">Workspace admin</span>
        </div>
        <form action="/logout" method="post">
          <button type="submit" title="Sign out" className={`mt-2 flex min-h-9 w-full items-center justify-center gap-2 rounded-lg text-xs transition sm:justify-start sm:px-2 text-[#5c584d] hover:bg-[#ebe6dc]`}>
            <LogOut aria-hidden="true" className="size-4" /><span className="sr-only sm:not-sr-only">Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
