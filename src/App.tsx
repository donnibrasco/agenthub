import React from 'react';
import { NeuroProvider, useNeuro } from './context/NeuroContext';
import { NeuroSidebar } from './components/NeuroSidebar';
import { NeuroHeader } from './components/NeuroHeader';
import { DashboardView } from './components/DashboardView';
import { AgentsListView } from './components/AgentsListView';
import { WorkflowsListView } from './components/WorkflowsListView';
import { JobsManagementView } from './components/JobsManagementView';
import { ImprovementsView } from './components/ImprovementsView';
import { AnalyticsView } from './components/AnalyticsView';
import { LaunchAgentModal } from './components/LaunchAgentModal';
import { ConnectModelModal } from './components/ConnectModelModal';

function NeuroApp() {
  const { activeTab } = useNeuro();

  return (
    <div className="min-h-screen flex bg-[#111214] text-slate-100 font-sans antialiased">
      
      {/* Left Sidebar */}
      <NeuroSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header */}
        <NeuroHeader />

        {/* Viewport Content */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
          {activeTab === 'dashboards' && <DashboardView />}
          {activeTab === 'agents' && <AgentsListView />}
          {activeTab === 'jobs' && <JobsManagementView />}
          {activeTab === 'improvements' && <ImprovementsView />}
          {activeTab === 'workflows' && <WorkflowsListView />}
          {activeTab === 'analytics' && <AnalyticsView />}
        </main>

        {/* Modals */}
        <LaunchAgentModal />
        <ConnectModelModal />

      </div>

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
