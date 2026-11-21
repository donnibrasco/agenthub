import { useNeuro } from '../context/NeuroContext';

export function WorkflowsListView() {
  const { workflows, searchQuery } = useNeuro();
  const query = searchQuery.trim().toLowerCase();
  const visibleWorkflows = workflows.filter(workflow =>
    workflow.title.toLowerCase().includes(query) || workflow.description.toLowerCase().includes(query)
  );

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-[#fffdfa] border border-[#e7e2d9]">
        <h1 className="text-3xl font-semibold tracking-tight text-[#282820] sm:text-4xl">Workflows</h1>
      </div>
      {visibleWorkflows.length === 0 && (
        <p className="p-6 rounded-3xl bg-[#fffdfa] border border-[#e7e2d9] text-sm text-[#665f54]">
          {workflows.length ? 'No workflows match your search.' : 'No workflows are configured.'}
        </p>
      )}
      {visibleWorkflows.map(workflow => (
        <div key={workflow.id} className="p-5 rounded-3xl bg-[#fffdfa] border border-[#e7e2d9] space-y-2">
          <h2 className="text-sm font-semibold text-[#282820]">{workflow.title}</h2>
          <p className="text-xs text-[#665f54]">{workflow.description}</p>
          <p className="text-xs text-[#665f54]">{workflow.stepsCount} steps · Last run {workflow.lastRun}</p>
        </div>
      ))}
    </div>
  );
}
