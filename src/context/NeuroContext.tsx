import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { findBestIdleAgent } from '../lib/jobAssignment';
import {
  ModelRuntime,
  ModelProvider,
  ModelConnectionPayload,
  normalizeEndpointDomain,
  generateConnectionFingerprint,
} from '../lib/modelConnection';
import {
  FrictionSignal,
  SignalCluster,
  ImprovementProposal,
  DailySignalPoint,
  applyImprovementDecision,
} from '../lib/improvementsEngine';

async function workspaceFetch(input: string, init?: RequestInit) {
  const response = await fetch(input, init);
  if (response.status === 401) window.location.replace('/login');
  return response;
}

export interface NeuroAgent {
  id: string;
  name: string;
  description: string;
  model: string;
  date: string;
  createdAt?: string;
  status: 'Active' | 'Idle' | 'Syncing';
  tokens: number;
  isRunning: boolean;
  category: string;
  score?: number;
  userVote?: 'up' | 'down' | null;
  author?: string;
  subreddit?: string;
  domain?: string;
  commentsCount?: number;
  endpointUrl?: string;
  runtime?: ModelRuntime;
  provider?: ModelProvider;
  latencyMs?: number;
  e2eeFingerprint?: string;
  lastPingAt?: string;
}

export interface RecentActivity {
  id: string;
  date: string;
  title: string;
  snippet: string;
  modelTag: string;
  bgColorClass: string;
  textColorClass: string;
  tagColorClass: string;
  response: string;
}

export interface WorkflowItem {
  id: string;
  title: string;
  description: string;
  stepsCount: number;
  lastRun: string;
  status: 'success' | 'running' | 'idle';
}

export interface JobLog {
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'success';
}

export interface NeuroJob {
  id: string;
  title: string;
  description: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'paused';
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignedType: 'agent' | 'user' | 'unassigned';
  assignedToId?: string;
  assignedToName?: string;
  assignedToRole?: string;
  category: 'Engineering' | 'Communication' | 'Design' | 'Search' | 'DataOps';
  estimatedTokens: number;
  consumedTokens?: number;
  progressPercent: number;
  createdAt: string;
  deadline?: string;
  logs: JobLog[];
  outputSummary?: string;
  payloadSpec?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
}

export interface ImproveFeedbackEntry {
  id: string;
  text: string;
  submittedAt: string;
}

export interface DeployInfo {
  ingestKey: string;
  telemetryPath: string;
  storageMode: string;
}

export interface EndpointProbeResult {
  reachable: boolean;
  httpStatus?: number;
  latencyMs: number;
  message: string;
}

export type ActiveTab =
  | 'dashboards'
  | 'agents'
  | 'jobs'
  | 'improvements'
  | 'workflows'
  | 'analytics';

interface NeuroContextType {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeLaunchAgent: NeuroAgent | null;
  setActiveLaunchAgent: (agent: NeuroAgent | null) => void;
  activeJobDetails: NeuroJob | null;
  setActiveJobDetails: (job: NeuroJob | null) => void;
  isConnectModalOpen: boolean;
  setIsConnectModalOpen: (open: boolean) => void;
  editingModel: NeuroAgent | null;
  setEditingModel: (model: NeuroAgent | null) => void;
  deployInfo: DeployInfo;
  refreshWorkspace: () => Promise<void>;
  probeEndpoint: (payload: { endpointUrl: string; provider: string; authToken?: string }) => Promise<EndpointProbeResult>;
  connectModel: (payload: ModelConnectionPayload) => Promise<NeuroAgent | null>;
  updateModelConnection: (id: string, payload: ModelConnectionPayload) => Promise<void>;
  pingConnectedModel: (id: string) => Promise<EndpointProbeResult>;
  disconnectModel: (id: string) => Promise<void>;
  agents: NeuroAgent[];
  activities: RecentActivity[];
  workflows: WorkflowItem[];
  jobs: NeuroJob[];
  teamMembers: TeamMember[];
  launchAgentPrompt: (agentId: string, promptText: string) => Promise<string>;
  toggleAgentStatus: (agentId: string) => Promise<void>;
  voteAgent: (agentId: string, direction: 'up' | 'down') => Promise<void>;
  assignJob: (jobId: string, assignedType: 'agent' | 'user', targetId: string, targetName: string) => Promise<void>;
  autoAssignJobToIdleAgent: (jobId: string) => Promise<{ success: boolean; agentName?: string }>;
  autoAssignAllQueuedJobs: () => Promise<number>;
  createJob: (jobData: Partial<NeuroJob>) => Promise<void>;
  updateJobStatus: (jobId: string, status: NeuroJob['status']) => Promise<void>;
  frictionSignals: FrictionSignal[];
  signalClusters: SignalCluster[];
  improvementProposals: ImprovementProposal[];
  totalAnalyzedMessages: number;
  dailySignalSeries: DailySignalPoint[];
  feedbackLog: ImproveFeedbackEntry[];
  resolveImprovement: (proposalId: string, decision: 'applied' | 'dismissed') => Promise<void>;
  scanModelsForFriction: () => Promise<number>;
  resetImprovementsBaseline: () => Promise<void>;
  submitImproveFeedback: (message: string) => Promise<void>;
}

const NeuroContext = createContext<NeuroContextType | null>(null);

export function NeuroProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboards');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeLaunchAgent, setActiveLaunchAgent] = useState<NeuroAgent | null>(null);
  const [activeJobDetails, setActiveJobDetails] = useState<NeuroJob | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [editingModel, setEditingModel] = useState<NeuroAgent | null>(null);

  const [agents, setAgents] = useState<NeuroAgent[]>([]);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [jobs, setJobs] = useState<NeuroJob[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [deployInfo, setDeployInfo] = useState<DeployInfo>({
    ingestKey: '',
    telemetryPath: '/api/telemetry/events',
    storageMode: 'sqlite',
  });

  const [frictionSignals, setFrictionSignals] = useState<FrictionSignal[]>([]);
  const [signalClusters, setSignalClusters] = useState<SignalCluster[]>([]);
  const [improvementProposals, setImprovementProposals] = useState<ImprovementProposal[]>([]);
  const [totalAnalyzedMessages, setTotalAnalyzedMessages] = useState<number>(0);
  const [dailySignalSeries, setDailySignalSeries] = useState<DailySignalPoint[]>([]);
  const [feedbackLog, setFeedbackLog] = useState<ImproveFeedbackEntry[]>([]);

  const applyImprovementsBundle = (bundle: {
    frictionSignals?: FrictionSignal[];
    signalClusters?: SignalCluster[];
    improvementProposals?: ImprovementProposal[];
    totalAnalyzedMessages?: number;
    dailySignalSeries?: DailySignalPoint[];
    feedbackLog?: ImproveFeedbackEntry[];
  }) => {
    if (bundle.frictionSignals) setFrictionSignals(bundle.frictionSignals);
    if (bundle.signalClusters) setSignalClusters(bundle.signalClusters);
    if (bundle.improvementProposals) setImprovementProposals(bundle.improvementProposals);
    if (typeof bundle.totalAnalyzedMessages === 'number') setTotalAnalyzedMessages(bundle.totalAnalyzedMessages);
    if (bundle.dailySignalSeries) setDailySignalSeries(bundle.dailySignalSeries);
    if (bundle.feedbackLog) setFeedbackLog(bundle.feedbackLog);
  };

  const refreshWorkspace = useCallback(async () => {
    try {
      const res = await workspaceFetch('/api/bootstrap');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.models)) setAgents(data.models);
      if (Array.isArray(data.jobs)) setJobs(data.jobs);
      if (Array.isArray(data.activities)) setActivities(data.activities);
      if (Array.isArray(data.workflows)) setWorkflows(data.workflows);
      if (Array.isArray(data.teamMembers)) setTeamMembers(data.teamMembers);
      if (data.deployInfo) setDeployInfo(data.deployInfo);
      if (data.improvements) applyImprovementsBundle(data.improvements);
    } catch (err) {
      console.error('Failed to load NeuroNest SQLite workspace:', err);
    }
  }, []);

  useEffect(() => {
    void refreshWorkspace();
  }, [refreshWorkspace]);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const probeEndpoint = async (payload: {
    endpointUrl: string;
    provider: string;
    authToken?: string;
  }): Promise<EndpointProbeResult> => {
    const res = await workspaceFetch('/api/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { reachable: false, latencyMs: 0, message: 'Probe request failed' };
    }
    return res.json();
  };

  const connectModel = async (payload: ModelConnectionPayload): Promise<NeuroAgent | null> => {
    const res = await workspaceFetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.model) {
      setAgents(prev => [data.model, ...prev]);
      await refreshWorkspace();
      return data.model;
    }
    return null;
  };

  const updateModelConnection = async (id: string, payload: ModelConnectionPayload) => {
    const domain = normalizeEndpointDomain(payload.endpointUrl);
    const fingerprint = generateConnectionFingerprint(`${payload.endpointUrl}|${payload.modelId}`);

    setAgents(prev =>
      prev.map(a =>
        a.id === id
          ? {
              ...a,
              name: payload.name.trim(),
              model: payload.modelId.trim(),
              description: payload.description?.trim() || a.description,
              category: payload.category,
              endpointUrl: payload.endpointUrl.trim(),
              runtime: payload.runtime,
              provider: payload.provider,
              domain,
              e2eeFingerprint: fingerprint,
              lastPingAt: 'Updated just now',
            }
          : a
      )
    );

    const res = await workspaceFetch(`/api/models/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.model) {
        setAgents(prev => prev.map(a => (a.id === id ? data.model : a)));
      }
    }
  };

  const pingConnectedModel = async (id: string): Promise<EndpointProbeResult> => {
    const res = await workspaceFetch(`/api/models/${encodeURIComponent(id)}/ping`, {
      method: 'POST',
    });
    if (!res.ok) {
      return { reachable: false, latencyMs: 0, message: 'Ping failed' };
    }
    const data = await res.json();
    if (data.model) {
      setAgents(prev => prev.map(a => (a.id === id ? data.model : a)));
    }
    return data.probe;
  };

  const disconnectModel = async (id: string) => {
    setAgents(prev => prev.filter(a => a.id !== id));
    if (activeLaunchAgent?.id === id) setActiveLaunchAgent(null);
    if (editingModel?.id === id) setEditingModel(null);

    await workspaceFetch(`/api/models/${encodeURIComponent(id)}`, { method: 'DELETE' });
  };

  const toggleAgentStatus = async (agentId: string) => {
    const current = agents.find(a => a.id === agentId);
    if (!current) return;
    const nextStatus = current.status === 'Active' ? 'Idle' : 'Active';

    setAgents(prev =>
      prev.map(a =>
        a.id === agentId ? { ...a, status: nextStatus, isRunning: nextStatus === 'Active' } : a
      )
    );

    await workspaceFetch(`/api/models/${encodeURIComponent(agentId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
  };

  const launchAgentPrompt = async (agentId: string, promptText: string): Promise<string> => {
    const target = agents.find(a => a.id === agentId) || agents[0];
    const res = await workspaceFetch(`/api/models/${encodeURIComponent(agentId)}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptText }),
    });

    if (!res.ok) {
      return `HTTP ${res.status} error calling backend proxy.`;
    }

    const data = await res.json();
    if (data.model) {
      setAgents(prev => prev.map(a => (a.id === agentId ? data.model : a)));
    }

    if (data.ok) {
      await refreshWorkspace();
      return `Live Response from ${target.name} (${target.model} · ${data.latencyMs}ms · ${data.tokensUsed} tokens):\n\n${data.output}`;
    }

    return `Upstream Endpoint Notice (${target.endpointUrl || target.domain}):\n${data.error}\n\nVerify the endpoint URL/API key in [ manage connection ] or ensure your tunnel/VPS can reach this host.`;
  };

  const voteAgent = async (agentId: string, direction: 'up' | 'down') => {
    const current = agents.find(a => a.id === agentId);
    if (!current) return;

    const currentVote = current.userVote ?? null;
    let delta = 0;
    let newVote: 'up' | 'down' | null = null;

    if (direction === 'up') {
      if (currentVote === 'up') {
        delta = -1;
        newVote = null;
      } else if (currentVote === 'down') {
        delta = 2;
        newVote = 'up';
      } else {
        delta = 1;
        newVote = 'up';
      }
    } else {
      if (currentVote === 'down') {
        delta = 1;
        newVote = null;
      } else if (currentVote === 'up') {
        delta = -2;
        newVote = 'down';
      } else {
        delta = -1;
        newVote = 'down';
      }
    }

    const nextScore = (current.score ?? 0) + delta;
    setAgents(prev =>
      prev.map(a => (a.id === agentId ? { ...a, score: nextScore, userVote: newVote } : a))
    );

    await workspaceFetch(`/api/models/${encodeURIComponent(agentId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: nextScore, userVote: newVote }),
    });
  };

  const assignJob = async (
    jobId: string,
    assignedType: 'agent' | 'user',
    targetId: string,
    targetName: string
  ) => {
    const currentJob = jobs.find(j => j.id === jobId);
    const nextStatus = currentJob?.status === 'queued' ? 'in_progress' : currentJob?.status;

    const res = await workspaceFetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignedType,
        assignedToId: targetId,
        assignedToName: targetName,
        status: nextStatus,
        logMessage: `Job dispatched to ${assignedType === 'agent' ? 'CONNECTED MODEL' : 'USER'}: ${targetName}.`,
        logLevel: 'info',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.jobs) setJobs(data.jobs);
      if (data.models) setAgents(data.models);
    }
  };

  const autoAssignJobToIdleAgent = async (
    jobId: string
  ): Promise<{ success: boolean; agentName?: string }> => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return { success: false };

    const idleAgent = findBestIdleAgent(job, agents);
    if (!idleAgent) return { success: false };

    const res = await workspaceFetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignedType: 'agent',
        assignedToId: idleAgent.id,
        assignedToName: idleAgent.name,
        status: 'in_progress',
        logMessage: `Auto-assigned to dormant connected model "${idleAgent.name}" (${idleAgent.model}). Status awakened to ACTIVE.`,
        logLevel: 'success',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.jobs) setJobs(data.jobs);
      if (data.models) setAgents(data.models);
      return { success: true, agentName: idleAgent.name };
    }
    return { success: false };
  };

  const autoAssignAllQueuedJobs = async (): Promise<number> => {
    const res = await workspaceFetch('/api/jobs/auto-assign', { method: 'POST' });
    if (!res.ok) return 0;
    const data = await res.json();
    if (data.jobs) setJobs(data.jobs);
    if (data.models) setAgents(data.models);
    return Number(data.assignedCount || 0);
  };

  const createJob = async (jobData: Partial<NeuroJob>) => {
    const res = await workspaceFetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.jobs) setJobs(data.jobs);
      if (data.models) setAgents(data.models);
    }
  };

  const updateJobStatus = async (jobId: string, status: NeuroJob['status']) => {
    const res = await workspaceFetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        logMessage: `Job status transitioned to ${status.toUpperCase()}.`,
        logLevel: status === 'completed' ? 'success' : status === 'failed' ? 'warn' : 'info',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.jobs) setJobs(data.jobs);
    }
  };

  const resolveImprovement = async (proposalId: string, decision: 'applied' | 'dismissed') => {
    setImprovementProposals(prev => applyImprovementDecision(prev, proposalId, decision));
    const res = await workspaceFetch(`/api/improvements/${encodeURIComponent(proposalId)}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.improvements) applyImprovementsBundle(data.improvements);
    }
  };

  const scanModelsForFriction = async (): Promise<number> => {
    const res = await workspaceFetch('/api/improvements/scan', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      if (data.improvements) applyImprovementsBundle(data.improvements);
    }
    return 1;
  };

  const resetImprovementsBaseline = async () => {
    setFrictionSignals([]);
    setSignalClusters([]);
    setImprovementProposals(prev =>
      prev.map(p => (p.status === 'pending' ? { ...p, status: 'dismissed' } : p))
    );
    setTotalAnalyzedMessages(0);
    setDailySignalSeries([]);

    const res = await workspaceFetch('/api/improvements/reset', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      if (data.improvements) applyImprovementsBundle(data.improvements);
    }
  };

  const submitImproveFeedback = async (message: string) => {
    if (!message.trim()) return;
    const res = await workspaceFetch('/api/improvements/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.improvements) applyImprovementsBundle(data.improvements);
    }
  };

  return (
    <NeuroContext.Provider
      value={{
        activeTab,
        setActiveTab,
        searchQuery,
        setSearchQuery,
        activeLaunchAgent,
        setActiveLaunchAgent,
        activeJobDetails,
        setActiveJobDetails,
        isConnectModalOpen,
        setIsConnectModalOpen,
        editingModel,
        setEditingModel,
        deployInfo,
        refreshWorkspace,
        probeEndpoint,
        connectModel,
        updateModelConnection,
        pingConnectedModel,
        disconnectModel,
        agents,
        activities,
        workflows,
        jobs,
        teamMembers,
        launchAgentPrompt,
        toggleAgentStatus,
        voteAgent,
        assignJob,
        autoAssignJobToIdleAgent,
        autoAssignAllQueuedJobs,
        createJob,
        updateJobStatus,
        frictionSignals,
        signalClusters,
        improvementProposals,
        totalAnalyzedMessages,
        dailySignalSeries,
        feedbackLog,
        resolveImprovement,
        scanModelsForFriction,
        resetImprovementsBaseline,
        submitImproveFeedback,
      }}
    >
      {children}
    </NeuroContext.Provider>
  );
}

export function useNeuro() {
  const context = useContext(NeuroContext);
  if (!context) {
    throw new Error('useNeuro must be used within a NeuroProvider');
  }
  return context;
}
