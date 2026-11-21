import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { MessageCircle } from 'lucide-react';
import { NeuroProvider, useNeuro, type ActiveTab } from './context/NeuroContext';
import { NeuroSidebar } from './components/NeuroSidebar';
import { NeuroHeader } from './components/NeuroHeader';
import { DashboardView } from './components/DashboardView';
import { ConnectionsView } from './components/ConnectionsView';
import { WorkflowsListView } from './components/WorkflowsListView';
import { JobsManagementView } from './components/JobsManagementView';
import { ImprovementsView } from './components/ImprovementsView';
import { AnalyticsView } from './components/AnalyticsView';
import { LaunchAgentModal } from './components/LaunchAgentModal';
import { ConnectModelModal } from './components/ConnectModelModal';
import { CodexChat } from './components/CodexChat';
import { TimelineView } from './components/TimelineView';
import { NewJobView } from './components/NewJobView';
import { JobThreadView } from './components/JobThreadView';

function NeuroApp() {
  const { activeTab, setActiveTab, jobs } = useNeuro();
  const [chatOpen, setChatOpen] = useState(false);
  const [thread, setThread] = useState<{ id: string; run: boolean } | null>(null);
  const chatOrigin = useRef<{ button: HTMLButtonElement; scrollY: number; tab: typeof activeTab } | null>(null);
  const timelineScroll = useRef(0);
  const showHeader = activeTab !== 'timeline' && activeTab !== 'new-chat';
  const selectedJob = thread && jobs.find(job => job.id === thread.id);

  function navigate(tab: ActiveTab) {
    setThread(null);
    setActiveTab(tab);
    window.scrollTo(0, 0);
  }

  function openJob(id: string, run = false) {
    timelineScroll.current = activeTab === 'timeline' ? window.scrollY : 0;
    setThread({ id, run });
    setActiveTab('timeline');
    window.scrollTo(0, 0);
  }

  function closeThread() {
    setThread(null);
    window.requestAnimationFrame(() => window.scrollTo(0, timelineScroll.current));
  }

  function openChat(event: MouseEvent<HTMLButtonElement>) {
    chatOrigin.current = { button: event.currentTarget, scrollY: window.scrollY, tab: activeTab };
    setChatOpen(true);
  }

  useEffect(() => {
    if (chatOpen || !chatOrigin.current) return;
    const origin = chatOrigin.current;
    chatOrigin.current = null;
    if (origin.tab === activeTab) {
      window.scrollTo(0, origin.scrollY);
      origin.button.focus({ preventScroll: true });
    }
  }, [activeTab, chatOpen]);

  return (
    <div className="workspace-page min-h-screen font-sans antialiased">
      <div className={chatOpen ? 'hidden' : 'flex min-h-screen'}>
        <NeuroSidebar onNavigate={navigate} />
        <div className="flex min-w-0 flex-1 flex-col">
          {showHeader && <NeuroHeader />}
          <main className={`mx-auto w-full min-w-0 max-w-7xl flex-1 space-y-8 p-4 sm:p-6 md:p-8 ${showHeader && activeTab !== 'agents' ? 'pb-24 sm:pb-24 md:pb-24' : ''}`}>
            {activeTab === 'timeline' && (
              <>
                <div hidden={Boolean(selectedJob)}><TimelineView onNewChat={() => navigate('new-chat')} onOpenJob={openJob} /></div>
                {selectedJob && thread && <JobThreadView key={selectedJob.id} job={selectedJob} startOnOpen={thread.run} onBack={closeThread} />}
              </>
            )}
            {activeTab === 'new-chat' && <NewJobView onStarted={openJob} onAskCodex={openChat} />}
            {activeTab === 'dashboards' && <DashboardView />}
            {activeTab === 'agents' && <ConnectionsView onNewChat={() => navigate('new-chat')} />}
            {activeTab === 'jobs' && <JobsManagementView />}
            {activeTab === 'improvements' && <ImprovementsView />}
            {activeTab === 'workflows' && <WorkflowsListView />}
            {activeTab === 'analytics' && <AnalyticsView />}
          </main>
          <footer className={`mx-auto w-full max-w-7xl px-4 py-4 text-xs text-[#665f54] sm:px-6 md:px-8`}>
            by AgenticProcess
          </footer>
        </div>
        {showHeader && activeTab !== 'agents' && (
          <button type="button" onClick={openChat}
            className="workspace-primary fixed right-4 bottom-4 z-[60] rounded-full shadow-lg shadow-[#26251e]/15 sm:bottom-6 sm:right-6">
            <MessageCircle aria-hidden="true" className="size-4.5" /><span className="sr-only sm:not-sr-only">Ask Codex</span>
          </button>
        )}
      </div>

      <CodexChat open={chatOpen} onClose={() => setChatOpen(false)} />
      <LaunchAgentModal />
      <ConnectModelModal />
    </div>
  );
}

export default function App() {
  return (
    <NeuroProvider>
      <NeuroApp />
    </NeuroProvider>
  );
}
