import axios, { AxiosError, AxiosResponse } from 'axios';
import { message } from 'antd';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 可以在这里添加token等认证信息
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 统一错误处理
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    if (error.response) {
      const { status, data } = error.response;
      let errorMessage = '请求失败';

      switch (status) {
        case 400:
          errorMessage = '请求参数错误';
          break;
        case 401:
          errorMessage = '未授权，请重新登录';
          break;
        case 403:
          errorMessage = '拒绝访问';
          break;
        case 404:
          errorMessage = '请求的资源不存在';
          break;
        case 500:
          errorMessage = '服务器内部错误';
          break;
        case 502:
          errorMessage = '网关错误';
          break;
        case 503:
          errorMessage = '服务不可用';
          break;
        default:
          errorMessage = `请求失败 (${status})`;
      }

      const detail = (data as any)?.detail;
      const detailCode = typeof detail === 'object' ? detail?.code : undefined;

      const codeHintMap: Record<string, string> = {
        VALIDATION_ERROR: '参数校验失败，请检查输入内容',
        INTERNAL_SERVER_ERROR: '服务内部异常，请稍后重试',
        HTTP_400: '请求参数错误',
        HTTP_401: '登录状态失效，请重新登录',
        HTTP_403: '当前账号无权限执行该操作',
        HTTP_404: '请求资源不存在或已删除',
        HTTP_422: '提交数据格式不正确',
        HTTP_500: '服务器处理失败，请稍后重试',
      };

      const normalizedMessage =
        typeof detail === 'string'
          ? detail
          : detail?.message || codeHintMap[detailCode || ''] || errorMessage;
      message.error(normalizedMessage);
    } else if (error.request) {
      message.error('网络错误，请检查网络连接');
    } else {
      message.error('请求配置错误');
    }

    return Promise.reject(error);
  }
);

export const configApi = {
  get: () => api.get('/config/'),
  update: (data: any) => api.post('/config/update', data),
};

export interface SlowQuery {
  id: number;
  sql_fingerprint: string;
  sql_text: string;
  execution_time: number;
  lock_time: number;
  rows_sent: number;
  rows_examined: number;
  database: string;
  timestamp: string;
  query_time: number;
  client_ip: string;
  user: string;
}

export interface ExecutionPlanNode {
  id: number;
  label: string;
  type: string;
  rows: number;
  cost: number;
  table: string;
}

export interface ExecutionPlanEdge {
  from: number;
  to: number;
}

export interface ExecutionPlanVisualization {
  nodes: ExecutionPlanNode[];
  edges: ExecutionPlanEdge[];
}

export interface OptimizationSuggestion {
  id: number;
  slow_query_id: number;
  suggestion_type: string;
  description: string;
  priority: string;
  impact_score: number;
  sql_statement?: string;
  owner?: string;
  due_date?: string;
  exec_status?: 'todo' | 'doing' | 'verifying' | 'done' | string;
  created_at: string;
  applied?: boolean;
  applied_at?: string;
}

export interface DatabaseMetrics {
  qps: number;
  connections: number;
  active_connections: number;
  innodb: {
    buffer_pool_reads?: number;
    buffer_pool_read_requests?: number;
    rows_read?: number;
    rows_inserted?: number;
    rows_updated?: number;
    rows_deleted?: number;
  };
  uptime: number;
  questions: number;
  slow_queries: number;
}

export interface SlowQueryStats {
  total: number;
  avg_execution_time: number;
  max_execution_time: number;
  by_database: Record<string, number>;
}

export interface Alert {
  id: number;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info' | string;
  current_value: number | string;
  threshold_value: number | string;
  created_at: string;
}

export interface SQLScoreDeduction {
  reason: string;
  deduction: number;
  detail?: string;
}

export interface SQLScoreResult {
  total_score: number;
  max_score: number;
  grade: string;
  scores: {
    execution_time: number;
    efficiency: number;
    structure: number;
    execution_plan: number;
  };
  deductions?: SQLScoreDeduction[];
  recommendations?: string[];
}

export interface AIFusionAnomaly {
  timestamp: string;
  severity: string;
  fusion: {
    stat_metric_hits: number;
    isolation_forest: boolean;
    iforest_score: number;
  };
  details: {
    timestamp: string;
    metric: string;
    value: number;
    robust_z: number;
    ewma_score: number;
  }[];
}

export interface AIPredictionResult {
  data_source?: string;
  lookback_hours?: number;
  training_points?: number;
  predictions: {
    qps: number;
    cpu_usage: number;
    memory_usage: number;
    disk_io: number;
    connections: number;
    slow_query_count: number;
  }[];
  trends: Record<string, string>;
  anomalies: AIFusionAnomaly[];
}

export interface AIOptimizeSuggestion {
  type: string;
  message: string;
  risk: 'low' | 'medium' | 'high' | string;
  confidence: number;
}

export interface AIOptimizeResult {
  mode?: string;
  execution_policy?: string;
  original_sql: string;
  optimized_sql_suggestion: string;
  complexity: {
    nested_level: number;
    join_count: number;
    where_conditions: number;
    order_by_count: number;
    group_by_count: number;
    complexity_score: number;
  };
  suggestions?: AIOptimizeSuggestion[];
  risk_label?: string;
}

export interface IndexRecommendation {
  type: string;
  columns: string[];
  source?: string;
  reason: string;
  benefit: string;
  confidence?: number;
  risk?: {
    write_amplification?: string;
    redundancy_check_required?: boolean;
  };
}

export interface AIIndexRecommendationResult {
  patterns: {
    where_columns: Record<string, number>;
    order_by_columns: Record<string, number>;
    group_by_columns: Record<string, number>;
    join_columns: Record<string, number>;
  };
  recommendations: IndexRecommendation[];
}

export interface AIDiagnosticRecommendation {
  id?: string;
  title: string;
  action: string;
  risk: 'low' | 'medium' | 'high' | string;
  confidence: number;
  impact_estimate?: {
    latency_reduction_pct?: number;
    throughput_improvement_pct?: number;
    resource_saving_pct?: number;
  };
  evidence?: Record<string, any>;
}

export interface AIEvidenceNode {
  id: string;
  type: 'root' | 'trend' | 'anomaly' | 'recommendation' | string;
  label: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'warning' | string;
  metadata?: Record<string, any>;
}

export interface AIEvidenceLink {
  source: string;
  target: string;
  relation: string;
}

export interface AIRootCauseProbability {
  cause: string;
  probability: number;
  evidence_refs?: string[];
}

export interface AIRecommendationConflict {
  type: string;
  description: string;
  recommendations: string[];
  resolution_hint: string;
}

export interface AISlaAssessment {
  target: {
    p95_latency_ms: number;
    max_cpu_usage_pct: number;
    max_error_risk_score: number;
  };
  current: {
    estimated_p95_latency_ms: number;
    estimated_cpu_usage_pct: number;
    error_risk_score: number;
  };
  breach_risk: 'low' | 'medium' | 'high' | string;
}

export interface AIDiagnosticResult {
  trace_id?: string;
  summary?: {
    sample_size: number;
    anomaly_count: number;
    high_risk_recommendations: number;
  };
  trends: Record<string, string>;
  anomalies: AIFusionAnomaly[];
  recommendations: AIDiagnosticRecommendation[];
  evidence_chain?: {
    nodes: AIEvidenceNode[];
    links: AIEvidenceLink[];
  };
  root_cause_probabilities?: AIRootCauseProbability[];
  recommendation_conflicts?: AIRecommendationConflict[];
  sla_assessment?: AISlaAssessment;
}

export const slowQueryApi = {
  list: (params?: {
    skip?: number;
    limit?: number;
    database?: string;
    min_execution_time?: number;
  }) => api.get<SlowQuery[]>('/slow-queries/', { params }),
  get: (id: number) => api.get<SlowQuery>(`/slow-queries/${id}`),
  create: (data: any) => api.post<SlowQuery>('/slow-queries/', data),
  stats: () => api.get<SlowQueryStats>('/slow-queries/stats/summary'),
  clusters: (top_n: number = 10) => api.get(`/slow-queries/clusters/top?top_n=${top_n}`),
};

export const executionPlanApi = {
  analyze: (sql: string) => api.post('/execution-plans/analyze', { sql }),
  visualize: (query_id: number) => api.get(`/execution-plans/visualize/${query_id}`),
};

export const optimizationApi = {
  generate: (data: { slow_query_id: number; sql: string }) =>
    api.post('/optimization/generate-suggestions', data),
  getSuggestions: (query_id: number) =>
    api.get(`/optimization/suggestions/${query_id}`),
  getTop: (limit: number = 20) =>
    api.get(`/optimization/suggestions/top?limit=${limit}`),
  updatePlan: (
    suggestionId: number,
    payload: { owner?: string; due_date?: string; exec_status?: 'todo' | 'doing' | 'verifying' | 'done' | string }
  ) => api.post(`/optimization/suggestions/${suggestionId}/plan`, payload),
};

export const alertsApi = {
  getActive: () => api.get<Alert[]>('/alerts/active'),
  resolve: (alertId: number) => api.post(`/alerts/${alertId}/resolve`),
  dismiss: (alertId: number) => api.post(`/alerts/${alertId}/dismiss`),
  toTicket: (alertId: number) => api.post(`/alerts/${alertId}/to-ticket`),
};

export const scoringApi = {
  scoreSQL: (queryId: number) => api.get<SQLScoreResult>(`/scoring/sql/${queryId}`),
};

export const metricsApi = {
  database: () => api.get<DatabaseMetrics>('/metrics/database'),
  tables: () => api.get('/metrics/tables'),
  status: () => api.get('/metrics/status'),
};

export interface OpsInstance {
  instance_id: string;
  name: string;
  engine: string;
  version: string;
  status: string;
  connections: number;
  qps_estimate: number;
  env?: string;
  biz_line?: string;
  criticality?: string;
  tags?: string[];
}

export interface OpsInstancesResult {
  instances: OpsInstance[];
  count: number;
  group_summary?: {
    by_env?: Record<string, number>;
    by_criticality?: Record<string, number>;
  };
  data_source: string;
}

export interface WorkloadProfileResult {
  workload_type: string;
  read_ratio: number;
  write_ratio: number;
  patterns: Record<string, number>;
  hotspots: { table: string; hits: number }[];
  sample_size: number;
  data_source: string;
}

export interface SessionLockResult {
  sessions: {
    id: number;
    user: string;
    db: string;
    command: string;
    state: string;
    time: number;
    sql: string;
  }[];
  blockers: {
    session_id: number;
    reason: string;
    duration_sec: number;
    user: string;
  }[];
  summary: {
    total_sessions: number;
    suspected_blockers: number;
    high_risk: number;
  };
  data_source: string;
}

export interface ChangeRiskResult {
  risk_level: 'low' | 'medium' | 'high' | string;
  score: number;
  change_type?: string;
  reasons: string[];
  guards: string[];
  estimated_impact: {
    write_latency_increase_pct: number;
    read_gain_pct: number;
    lock_risk: string;
  };
}

export interface CapacityBaselineResult {
  baseline: {
    date: string;
    qps: number;
    connections: number;
    storage_used_gb: number;
  }[];
  forecast_7d: {
    day_offset: number;
    predicted_qps: number;
    predicted_connections: number;
    predicted_storage_gb: number;
  }[];
  capacity_risk: {
    qps: string;
    connections: string;
    storage: string;
    overall: string;
  };
  recommendations?: string[];
  data_source: string;
}

export interface RunbookResult {
  incident_type: string;
  severity: string;
  runbook: {
    title: string;
    steps: string[];
    commands: string[];
    rollback: string[];
  };
  sla_guard: {
    max_step_minutes: number;
    owner: string;
  };
  data_source: string;
}

export interface OpsActionLogItem {
  id?: number;
  action: string;
  instance?: string;
  result: string;
  time: string;
}

export interface OpsActionLogListResult {
  items: OpsActionLogItem[];
  count: number;
}


export const exportApi = {
  slowQueriesCSV: (database?: string, limit: number = 1000) =>
    api.get('/export/slow-queries/csv', {
      params: { database, limit },
      responseType: 'blob',
    }),
};

export const opsApi = {
  instances: () => api.get<OpsInstancesResult>('/ops/instances'),
  workloadProfile: () => api.get<WorkloadProfileResult>('/ops/workload-profile'),
  sessionLocks: () => api.get<SessionLockResult>('/ops/session-locks'),
  assessChangeRisk: (sql: string, changeType: string = 'ddl') =>
    api.post<ChangeRiskResult>('/ops/change-risk/assess', { sql, change_type: changeType }),
  capacityBaseline: () => api.get<CapacityBaselineResult>('/ops/capacity/baseline'),
  generateRunbook: (incidentType: string, severity: string = 'medium') =>
    api.post<RunbookResult>('/ops/runbook/generate', { incident_type: incidentType, severity }),
  createActionLog: (action: string, result: string, instance?: string) =>
    api.post('/ops/action-log', { action, result, instance }),
  listActionLogs: (
    limit: number = 20,
    filters?: { action?: string; instance?: string; timeRange?: '1h' | '24h' | '7d' | 'all' }
  ) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (filters?.action && filters.action !== 'all') params.set('action', filters.action);
    if (filters?.instance && filters.instance !== 'all') params.set('instance', filters.instance);
    if (filters?.timeRange && filters.timeRange !== 'all') params.set('time_range', filters.timeRange);
    return api.get<OpsActionLogListResult>(`/ops/action-log?${params.toString()}`);
  },
};

export interface TicketItem {
  id: number;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'waiting_acceptance' | 'closed' | string;
  reporter_id?: number;
  assignee_id?: number;
  eta_minutes?: number;
  due_at?: string;
  location?: string;
  asset_code?: string;
  adopted_optimization_suggestion_id?: number;
  adopted_optimization_note?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface TicketListResult {
  items: TicketItem[];
  count: number;
}

export interface TicketEventItem {
  id: number;
  ticket_id: number;
  actor_id?: number;
  event_type: string;
  content: string;
  created_at: string;
}

export interface TicketEventListResult {
  items: TicketEventItem[];
  count: number;
}

export interface TicketRatingSummary {
  count: number;
  avg_response_speed: number;
  avg_service_attitude: number;
  avg_overall: number;
}

export interface DutyShiftItem {
  id: number;
  user_id: number;
  role: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at?: string;
}

export interface DutyShiftListResult {
  items: DutyShiftItem[];
  count: number;
}

export const ticketsApi = {
  create: (payload: {
    title: string;
    description: string;
    category?: string;
    severity?: string;
    reporter_id?: number;
    location?: string;
    asset_code?: string;
    drill_mode?: boolean;
  }) => api.post<{ ticket: TicketItem }>('/tickets/', payload),

  list: (params?: { status?: string; limit?: number }) =>
    api.get<TicketListResult>('/tickets/', { params }),

  get: (ticketId: number) => api.get<{ ticket: TicketItem }>(`/tickets/${ticketId}`),

  assign: (ticketId: number, assignee_id?: number) =>
    api.post<{ ticket: TicketItem }>(`/tickets/${ticketId}/assign`, { assignee_id }),

  setStatus: (
    ticketId: number,
    status: TicketItem['status'],
    options?: { adopted_optimization_suggestion_id?: number; adopted_optimization_note?: string }
  ) =>
    api.post<{ ticket: TicketItem }>(`/tickets/${ticketId}/status`, {
      status,
      adopted_optimization_suggestion_id: options?.adopted_optimization_suggestion_id,
      adopted_optimization_note: options?.adopted_optimization_note,
    }),

  setEta: (ticketId: number, eta_minutes: number) =>
    api.post<{ ticket: TicketItem }>(`/tickets/${ticketId}/eta`, { eta_minutes }),

  events: (ticketId: number) =>
    api.get<TicketEventListResult>(`/tickets/${ticketId}/events`),

  createRating: (ticketId: number, payload: { response_speed_score: number; service_attitude_score: number; comment?: string; rater_id?: number }) =>
    api.post(`/tickets/${ticketId}/rating`, payload),

  ratingSummary: () => api.get<TicketRatingSummary>('/tickets/ratings/summary'),

  drillReport: () => api.get<{ total: number; closed: number; close_rate: number; items: { id: number; title: string; status: string; severity: string; created_at: string }[] }>('/tickets/drill-report'),
};

export interface KnowledgeItem {
  id: number;
  title: string;
  keywords?: string;
  content: string;
  category: string;
  view_count: number;
  solve_count: number;
  solve_rate: number;
  created_at?: string;
  updated_at?: string;
}

export interface KnowledgeListResult {
  items: KnowledgeItem[];
  count: number;
}

export const dutyApi = {
  listShifts: () => api.get<DutyShiftListResult>('/duty/shifts'),
  createShift: (payload: { user_id: number; role?: string; start_time: string; end_time: string; is_active?: boolean }) =>
    api.post('/duty/shifts', payload),
  deleteShift: (shiftId: number) => api.delete(`/duty/shifts/${shiftId}`),
};

export const knowledgeApi = {
  list: (params?: { q?: string; limit?: number }) => api.get<KnowledgeListResult>('/knowledge/', { params }),
  create: (payload: { title: string; keywords?: string; content: string; category?: string }) =>
    api.post('/knowledge/', payload),
  markView: (id: number) => api.post(`/knowledge/${id}/view`),
  markSolve: (id: number) => api.post(`/knowledge/${id}/solve`),
};

export interface AssistantStatsResult {
  count: number;
  avg_latency_ms: number;
  fallback_rate: number;
  engine_distribution: Record<string, number>;
  scene_distribution: Record<string, number>;
}

export const assistantApi = {
  chat: (message: string) => api.post('/assistant/chat', { message }),
  intake: (text: string, mode: 'auto' | 'rule' | 'llm' = 'auto') => api.post('/assistant/intake', { text, mode }),
  stats: () => api.get<AssistantStatsResult>('/assistant/stats'),
  handoverSummary: (payload: { shift_name?: string; unresolved_tickets?: string[]; incidents?: string[] }) =>
    api.post('/assistant/handover-summary', payload),
};

export const aiApi = {
  predict: (metrics: any, steps: number = 1) => api.post<AIPredictionResult>('/ai/predict', { current_metrics: metrics, steps }),
  optimizeSql: (sql: string) => api.post<AIOptimizeResult>('/ai/optimize-sql', { sql }),
  recommendIndexes: (queries: string[]) => api.post<AIIndexRecommendationResult>('/ai/recommend-indexes', queries),
  diagnose: (metricsData: any[]) => api.post<AIDiagnosticResult>('/ai/diagnose', metricsData),
};

export const apiService = {
  ...slowQueryApi,
  ...executionPlanApi,
  ...optimizationApi,
  ...alertsApi,
  ...scoringApi,
  ...metricsApi,
  ...exportApi,
  ...configApi,
  ...aiApi,
};

export default api;
