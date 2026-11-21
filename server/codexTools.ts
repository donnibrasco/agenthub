import type { NeuroAgent, NeuroJob } from '../src/context/NeuroContext.tsx';
import type { CodexAction } from '../src/lib/codexChat.ts';
import { isAgentGatewayProvider, MODEL_PROVIDERS } from '../src/lib/modelConnection.ts';
import { NeuroDatabase } from './db.ts';
import { WorkspaceActionError, type WorkspaceActions } from './workspaceActions.ts';

const runtimes = ['Local Workstation', 'Self-Hosted vLLM', 'Self-Hosted Server', 'Cloud API', 'Kubernetes Cluster'] as const;
const modelStatuses = ['Active', 'Idle', 'Syncing'] as const;
const jobStatuses = ['queued', 'in_progress', 'completed', 'failed', 'paused'] as const;
const priorities = ['critical', 'high', 'medium', 'low'] as const;
const categories = ['Engineering', 'Communication', 'Design', 'Search', 'DataOps'] as const;

type Field = { type: 'string' | ['string', 'null']; enum?: readonly (string | null)[]; description?: string };
const required = (description?: string): Field => ({ type: 'string', description });
const optional = (description?: string): Field => ({ type: ['string', 'null'], description });
const choice = (values: readonly string[]): Field => ({ type: ['string', 'null'], enum: [...values, null] });

function define(name: string, description: string, properties: Record<string, Field> = {}) {
  return {
    type: 'function', name, description, strict: true,
    parameters: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
  } as const;
}

const modelId = required('AgentHub connection ID from list_models, distinct from the provider model ID.');
const jobId = required('AgentHub job record ID from list_jobs.');
const configuration = {
  provider: choice(MODEL_PROVIDERS), runtime: choice(runtimes), category: optional(), description: optional(),
};

export const codexTools = [
  define('list_models', 'Find connected models by name, provider, or model identifier. Use a null search to see all models.', { search: optional() }),
  define('get_model', 'Read details for a connected model. Credentials are never returned.', { id: modelId }),
  define('connect_model', 'Register an existing agent or model endpoint in AgentHub. Use the endpoint and model identifier supplied by the user, or a known official provider URL. If the endpoint needs a key, offer manage_connection after registration.', {
    name: required(), modelId: required('Identifier understood by the provider.'), endpointUrl: required('HTTP(S) API base URL.'), ...configuration,
  }),
  define('update_model', 'Update settings or set an agent Active or Idle in AgentHub. Pass null for fields that should stay as they are. Changing origin or provider clears the existing credential.', {
    id: modelId, name: optional(), modelId: optional('Provider model identifier.'), endpointUrl: optional(), ...configuration, status: choice(modelStatuses),
  }),
  define('ping_model', 'Check whether the saved model endpoint returns a model list and record the measured latency.', { id: modelId }),
  define('run_model', 'Send a prompt to one connected model when the user asks to run or delegate a task. Use the saved connection and credentials. Returns that model’s reply.', {
    id: modelId, prompt: required(),
  }),
  define('manage_connection', 'Show a button that opens the saved model in the secure connection editor, for API keys or manual settings. Never ask for credentials in chat.', { id: modelId }),
  define('prepare_disconnect', 'Offer the user a button to confirm disconnecting the requested model from AgentHub.', { id: modelId }),
  define('list_jobs', 'Find workspace jobs by title, or list jobs with a null search.', { search: optional() }),
  define('create_job', 'Queue an AgentHub job. Optionally assign it to a connected model using its AgentHub connection ID. Queueing does not run the model.', {
    title: required(), description: required(), priority: choice(priorities), category: choice(categories), modelId: optional('AgentHub connection ID.'),
  }),
  define('update_job', 'Change a workspace job status, assign it to a connected model, or both. Assignment does not run the model.', {
    id: jobId, status: choice(jobStatuses), modelId: optional('AgentHub connection ID.'),
  }),
  define('list_workflows', 'Read the workspace workflow catalog and its recorded status.'),
];

function text(args: Record<string, unknown>, field: string, max = 160) {
  const value = args[field];
  if (value == null) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new WorkspaceActionError(400, `${field} must be text between 1 and ${max} characters.`);
  }
  return value.trim();
}

function requireText(args: Record<string, unknown>, field: string, max?: number) {
  const value = text(args, field, max);
  if (!value) throw new WorkspaceActionError(400, `${field} is required.`);
  return value;
}

function fieldChoice<const T extends readonly string[]>(args: Record<string, unknown>, field: string, values: T): T[number] | undefined {
  const value = text(args, field);
  if (value && !values.includes(value)) throw new WorkspaceActionError(400, `Unsupported ${field}.`);
  return value as T[number] | undefined;
}

function endpoint(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new WorkspaceActionError(400, 'Use a valid HTTP(S) model endpoint.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new WorkspaceActionError(400, 'Use an HTTP(S) base URL without credentials, queries, or fragments.');
  }
  return url.toString().replace(/\/+$/, '');
}

function summarizeModel(model: NeuroAgent) {
  let endpointUrl: string | undefined;
  if (model.endpointUrl) {
    try {
      const url = new URL(model.endpointUrl);
      if (['http:', 'https:'].includes(url.protocol)) endpointUrl = `${url.origin}${url.pathname}`.slice(0, 500);
    } catch { /* Ignore legacy connection URLs that cannot be parsed. */ }
  }
  return {
    id: model.id, name: model.name.slice(0, 160), modelId: model.model.slice(0, 160), status: model.status,
    category: model.category.slice(0, 160), provider: model.provider, runtime: model.runtime,
    endpointUrl, lastPingAt: model.lastPingAt, latencyMs: model.latencyMs,
  };
}

function summarizeJob(job: NeuroJob) {
  return { id: job.id, title: job.title.slice(0, 160), status: job.status, priority: job.priority, assignedTo: job.assignedToName?.slice(0, 160) };
}

export function createCodexToolRunner(db: NeuroDatabase, workspace: WorkspaceActions, signal?: AbortSignal) {
  const actions: CodexAction[] = [];
  let workspaceChanged = false;

  function record(kind: CodexAction['kind'], id: string, summary: string, changed = false) {
    const seen = actions.find(action => action.kind === kind && action.id === id && action.summary === summary);
    if (!seen) actions.push({ kind, id, summary: summary.slice(0, 200) });
    workspaceChanged ||= changed;
  }

  function findModel(id: string) {
    const row = db.getModelRow(id);
    if (!row) throw new WorkspaceActionError(404, 'Model not found. Use list_models to find its ID.');
    return row;
  }

  async function invoke(name: string, args: Record<string, unknown>) {
    signal?.throwIfAborted();
    switch (name) {
      case 'list_models': {
        const search = text(args, 'search')?.toLowerCase() ?? '';
        const models = db.listModels().filter(model => `${model.name} ${model.model} ${model.provider}`.toLowerCase().includes(search));
        return { total: models.length, models: models.slice(0, 30).map(summarizeModel) };
      }
      case 'get_model': {
        const row = findModel(requireText(args, 'id'));
        return { ...summarizeModel(db.mapModelRow(row)), description: row.description.slice(0, 800), hasCredential: Boolean(row.auth_token_encrypted) };
      }
      case 'connect_model': {
        const endpointUrl = endpoint(requireText(args, 'endpointUrl', 500));
        const name = requireText(args, 'name');
        const modelId = requireText(args, 'modelId');
        const existing = db.listModels().find(model => model.model === modelId && model.endpointUrl?.replace(/\/+$/, '') === endpointUrl);
        if (existing) {
          record('model', existing.id, `Already connected: ${existing.name}`);
          return { alreadyExists: true, model: summarizeModel(existing) };
        }
        const provider = fieldChoice(args, 'provider', MODEL_PROVIDERS) ?? 'OpenAI-Compatible';
        const { model } = workspace.createModel({
          name, modelId, endpointUrl, provider,
          runtime: fieldChoice(args, 'runtime', runtimes) ?? (isAgentGatewayProvider(provider) ? 'Self-Hosted Server' : 'Cloud API'),
          category: text(args, 'category') ?? 'Engineering', description: text(args, 'description', 1200),
        });
        if (!model) throw new Error('Model was not returned after creation.');
        record('model', model.id, `Connected ${model.name}`, true);
        return { model: summarizeModel(model), message: 'Connection saved. Reachability and credentials have not been verified.' };
      }
      case 'update_model': {
        const row = findModel(requireText(args, 'id'));
        const newEndpoint = text(args, 'endpointUrl', 500);
        const { model } = workspace.updateModel(row.id, {
          name: text(args, 'name'), modelId: text(args, 'modelId'), endpointUrl: newEndpoint ? endpoint(newEndpoint) : undefined,
          provider: fieldChoice(args, 'provider', MODEL_PROVIDERS), runtime: fieldChoice(args, 'runtime', runtimes),
          category: text(args, 'category'), description: text(args, 'description', 1200), status: fieldChoice(args, 'status', modelStatuses),
        });
        if (!model) throw new WorkspaceActionError(404, 'Model not found.');
        record('model', model.id, `Updated ${model.name}`, true);
        const credentialCleared = Boolean(row.auth_token_encrypted && !db.getModelRow(row.id)?.auth_token_encrypted);
        return { model: summarizeModel(model), credentialCleared };
      }
      case 'ping_model': {
        const row = findModel(requireText(args, 'id'));
        const { probe } = await workspace.pingModel(row.id, signal);
        record('model', row.id, `Checked ${row.name}`, true);
        return { reachable: probe.reachable, httpStatus: probe.httpStatus, latencyMs: probe.latencyMs, message: probe.message };
      }
      case 'run_model': {
        const row = findModel(requireText(args, 'id'));
        const { ok, output, tokensUsed, latencyMs } = await workspace.runModel(row.id, requireText(args, 'prompt', 4000), signal);
        if (!ok) return { ok, error: 'The model did not complete the run. Check its connection and API key.' };
        record('model', row.id, `Ran ${row.name}`, true);
        return { ok, output: output.slice(0, 6000), tokensUsed, latencyMs };
      }
      case 'manage_connection': {
        const row = findModel(requireText(args, 'id'));
        record('model', row.id, `Connection settings for ${row.name}`);
        return { ok: true };
      }
      case 'prepare_disconnect': {
        const row = findModel(requireText(args, 'id'));
        record('disconnect', row.id, `Disconnect ${row.name}`);
        return { pendingUserConfirmation: true, model: row.name.slice(0, 160) };
      }
      case 'list_jobs': {
        const search = text(args, 'search')?.toLowerCase() ?? '';
        const jobs = db.listJobs().filter(job => job.title.toLowerCase().includes(search));
        return { total: jobs.length, jobs: jobs.slice(0, 30).map(summarizeJob) };
      }
      case 'create_job': {
        const modelId = text(args, 'modelId');
        const row = modelId ? findModel(modelId) : undefined;
        const { jobs, jobId } = workspace.createJob({
          title: requireText(args, 'title'), description: requireText(args, 'description', 1600),
          priority: fieldChoice(args, 'priority', priorities), category: fieldChoice(args, 'category', categories),
          assignedType: row ? 'agent' : 'unassigned', assignedToId: row?.id, assignedToName: row?.name,
        });
        const job = jobs.find(job => job.id === jobId);
        if (!job) throw new Error('Job was not returned after creation.');
        record('job', job.id, `Created job: ${job.title}`, true);
        return summarizeJob(job);
      }
      case 'update_job': {
        const id = requireText(args, 'id');
        const modelId = text(args, 'modelId');
        const row = modelId ? findModel(modelId) : undefined;
        const status = fieldChoice(args, 'status', jobStatuses);
        if (!row && !status) throw new WorkspaceActionError(400, 'Provide a status or a model to assign.');
        const { jobs } = workspace.updateJob(id, {
          status: status ?? 'in_progress',
          assignedType: row ? 'agent' : undefined, assignedToId: row?.id, assignedToName: row?.name,
          logMessage: row ? `Assigned to ${row.name} from Codex chat.` : undefined,
        });
        const job = jobs.find(job => job.id === id);
        if (!job) throw new WorkspaceActionError(404, 'Job not found.');
        record('job', job.id, `Updated job: ${job.title}`, true);
        return summarizeJob(job);
      }
      case 'list_workflows': {
        return [];
      }
      default:
        throw new WorkspaceActionError(400, 'Unknown workspace action.');
    }
  }

  return { actions, invoke, get workspaceChanged() { return workspaceChanged; } };
}
