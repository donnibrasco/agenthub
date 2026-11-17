export interface SortableAgent {
  id: string;
  name: string;
  status: 'Active' | 'Idle' | 'Syncing';
  date: string;
  createdAt?: string;
  tokens: number;
  score?: number;
}

export type AgentSortMode = 'active_first' | 'newest' | 'top_score' | 'top_tokens' | 'inactive_first';

export function getAgentTimestamp(agent: { createdAt?: string; date: string }): number {
  if (agent.createdAt) {
    const ts = new Date(agent.createdAt).getTime();
    if (!isNaN(ts)) return ts;
  }
  const parsed = new Date(agent.date).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Sorts agents with Reddit-style ordering rules:
 * - 'active_first' (default): Active agents are placed on top sorted by newest date first.
 *   Inactive/idle agents are placed at the bottom, also sorted by newest date first.
 */
export function sortAgentsByRedditRule<T extends SortableAgent>(
  agents: T[],
  mode: AgentSortMode = 'active_first'
): T[] {
  const copy = [...agents];

  switch (mode) {
    case 'active_first':
      return copy.sort((a, b) => {
        const aActive = a.status === 'Active';
        const bActive = b.status === 'Active';
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        // Within same active/inactive partition, newest date goes first
        return getAgentTimestamp(b) - getAgentTimestamp(a);
      });

    case 'newest':
      return copy.sort((a, b) => getAgentTimestamp(b) - getAgentTimestamp(a));

    case 'top_score':
      return copy.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    case 'top_tokens':
      return copy.sort((a, b) => b.tokens - a.tokens);

    case 'inactive_first':
      return copy.sort((a, b) => {
        const aActive = a.status === 'Active';
        const bActive = b.status === 'Active';
        if (!aActive && bActive) return -1;
        if (aActive && !bActive) return 1;
        return getAgentTimestamp(b) - getAgentTimestamp(a);
      });

    default:
      return copy;
  }
}
