export interface AssignableAgent {
  id: string;
  name: string;
  status: 'Active' | 'Idle' | 'Syncing';
  category: string;
  model: string;
  isRunning: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
}

export interface JobItem {
  id: string;
  title: string;
  description: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'paused';
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignedType: 'agent' | 'user' | 'unassigned';
  assignedToId?: string;
  assignedToName?: string;
  category: string;
  progressPercent: number;
  createdAt: string;
}

/**
 * Finds the best idle agent to fulfill an unassigned job.
 * Prioritizes matching category first, then any available idle agent.
 */
export function findBestIdleAgent(
  job: Pick<JobItem, 'category'>,
  agents: AssignableAgent[]
): AssignableAgent | null {
  const idleAgents = agents.filter(a => a.status === 'Idle');
  if (idleAgents.length === 0) return null;

  // Exact category match
  const match = idleAgents.find(
    a => a.category.toLowerCase() === job.category.toLowerCase()
  );
  return match || idleAgents[0];
}

/**
 * Computes agent fleet workload utilization metric.
 */
export function calculateFleetUtilization(agents: AssignableAgent[]): {
  activeCount: number;
  idleCount: number;
  total: number;
  utilizationRate: number;
} {
  const total = agents.length;
  if (total === 0) {
    return { activeCount: 0, idleCount: 0, total: 0, utilizationRate: 0 };
  }
  const activeCount = agents.filter(a => a.status === 'Active').length;
  const idleCount = total - activeCount;
  const utilizationRate = Math.round((activeCount / total) * 100);

  return { activeCount, idleCount, total, utilizationRate };
}
