// Common types and interfaces for the domain models

export interface User {
  id: string;
  github_id: string;
  username: string;
  email: string;
  avatar_url?: string;
  name?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: Date;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  workspace_id: string;
  owner_id: string;

  // Project metadata fields from B-005 requirements
  product_area?: string;
  goals?: string[];
  default_labels?: any[];
  default_persona_stack?: any;

  // GitHub repository connection (B-601, B-602)
  github_repo_url?: string;
  github_repo_id?: string;

  // Additional fields
  status: 'active' | 'archived' | 'draft';
  settings?: any;

  created_at: Date;
  updated_at: Date;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: Date;
}

// Request/Response DTOs
export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  workspace_id: string;
  product_area?: string;
  goals?: string[];
  default_labels?: any[];
  default_persona_stack?: any;
  github_repo_url?: string;
  github_repo_id?: string;
}

export interface WorkspaceWithProjects extends Workspace {
  projects: Project[];
  member_count: number;
}

export interface ProjectWithDetails extends Project {
  workspace: Workspace;
  owner: User;
}

export interface Requirement {
  id: string;
  title: string;
  description?: string;
  project_id: string;
  author_id: string;
  priority: number; // 1=highest, 5=lowest
  status: 'draft' | 'active' | 'completed' | 'archived';
  type: 'feature' | 'bug' | 'enhancement' | 'epic';
  github_issue_number?: number;
  github_issue_url?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Linear integration types (B-501)
export interface LinearConnection {
  id: string;
  project_id: string;

  // Linear API configuration
  api_token_hash: string;
  workspace_id: string;
  workspace_name?: string;
  team_id: string;
  team_name?: string;

  // Optional board/project mapping
  board_id?: string;
  board_name?: string;
  project_id_linear?: string;
  project_name_linear?: string;

  // Validation and status
  is_validated: boolean;
  validation_error?: string;
  last_validated_at?: Date;

  // Connection metadata
  linear_organization_id?: string;
  linear_organization_name?: string;
  permissions?: string[];

  created_at: Date;
  updated_at: Date;
}

// GitHub Repository Connection types
export interface GitHubRepository {
  id: string;
  project_id: string;

  // GitHub repository metadata
  github_repo_id: number;
  owner: string;
  name: string;
  full_name: string;
  description?: string;
  url: string;
  clone_url: string;
  ssh_url: string;

  // Repository details
  private: boolean;
  default_branch: string;
  language?: string;
  topics?: string[];

  // Access configuration
  access_level: 'read' | 'write' | 'admin';
  webhook_configured: boolean;

  created_at: Date;
  updated_at: Date;
}

// Request/Response DTOs for requirements
export interface CreateRequirementRequest {
  title: string;
  description?: string;
  project_id: string;
  priority?: number;
  type?: 'feature' | 'bug' | 'enhancement' | 'epic';
  github_issue_number?: number;
  github_issue_url?: string;
}

export interface RequirementWithDetails extends Requirement {
  project: Project;
  author: User;
}

export interface CreateLinearConnectionRequest {
  api_token: string;
  workspace_id: string;
  team_id: string;
  board_id?: string;
  project_id_linear?: string;
}

export interface UpdateLinearConnectionRequest {
  workspace_id?: string;
  team_id?: string;
  board_id?: string;
  project_id_linear?: string;
}

export interface LinearConnectionValidationResult {
  is_valid: boolean;
  workspace?: {
    id: string;
    name: string;
  };
  team?: {
    id: string;
    name: string;
  };
  board?: {
    id: string;
    name: string;
  };
  project?: {
    id: string;
    name: string;
  };
  organization?: {
    id: string;
    name: string;
  };
  permissions?: string[];
  error?: string;
}

export interface ProjectWithLinearConnection extends ProjectWithDetails {
  linear_connection?: LinearConnection;
}

export interface CreateGitHubRepositoryRequest {
  project_id: string;
  github_repo_id: number;
  owner: string;
  name: string;
  access_level?: 'read' | 'write' | 'admin';
}

export interface UpdateGitHubRepositoryRequest {
  access_level?: 'read' | 'write' | 'admin';
  webhook_configured?: boolean;
}

export interface ProjectWithRepository extends ProjectWithDetails {
  github_repository?: GitHubRepository;
}

// Context source recommendation and selection types (B-603)
export interface ContextSourceType {
  id: string;
  name: string;
  description: string;
  pattern: string; // File pattern or path
  priority: number; // 1=highest, 5=lowest
  category: 'documentation' | 'code' | 'config' | 'test';
}

export interface RecommendedContextSource {
  id: string;
  project_id: string;
  source_type_id: string;
  file_path: string;
  file_size?: number;
  last_modified?: Date;
  confidence_score: number; // 0-100, how confident we are this is useful
  is_recommended: boolean;
  recommendation_reason?: string;
}

export interface SelectedContextSource {
  id: string;
  project_id: string;
  source_type_id: string;
  file_path: string;
  is_selected: boolean;
  selected_by: string; // user_id
  selected_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ContextSourceRecommendation {
  source_type: ContextSourceType;
  files: RecommendedContextSource[];
  total_size?: number;
  recommendation_summary: string;
}

export interface ProjectContextAnalysis {
  project_id: string;
  github_repo_url: string;
  analyzed_at: Date;
  total_files_scanned: number;
  recommendations: ContextSourceRecommendation[];
  analysis_status: 'pending' | 'completed' | 'failed';
  error_message?: string;
}

// Request/Response DTOs for context sources
export interface AnalyzeProjectContextRequest {
  project_id: string;
  force_refresh?: boolean;
}

export interface UpdateContextSelectionRequest {
  selections: {
    file_path: string;
    is_selected: boolean;
  }[];
}
// AI Provider Audit interfaces (B-706)
export interface AIProviderAudit {
  id: string;
  requirement_id?: string;
  user_id?: string;
  provider_type: string;
  provider_model?: string;
  provider_endpoint?: string;
  correlation_id?: string;
  job_id?: string;
  session_context?: any;
  request_payload: any;
  response_payload?: any;
  response_status?: number;
  request_tokens?: number;
  response_tokens?: number;
  total_tokens?: number;
  latency_ms?: number;
  audit_level: 'full' | 'metadata-only' | 'disabled';
  retention_policy: 'standard' | 'extended' | 'minimal';
  is_successful: boolean;
  error_type?: string;
  error_message?: string;
  error_details?: any;
  request_timestamp: Date;
  response_timestamp?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAIProviderAuditRequest {
  requirement_id?: string;
  user_id?: string;
  provider_type: string;
  provider_model?: string;
  provider_endpoint?: string;
  correlation_id?: string;
  job_id?: string;
  session_context?: any;
  request_payload: any;
  response_payload?: any;
  response_status?: number;
  request_tokens?: number;
  response_tokens?: number;
  total_tokens?: number;
  latency_ms?: number;
  audit_level?: 'full' | 'metadata-only' | 'disabled';
  retention_policy?: 'standard' | 'extended' | 'minimal';
  is_successful?: boolean;
  error_type?: string;
  error_message?: string;
  error_details?: any;
  request_timestamp?: Date;
  response_timestamp?: Date;
}

export interface AIProviderAuditSummary {
  id: string;
  requirement_id?: string;
  user_id?: string;
  provider_type: string;
  provider_model?: string;
  date_bucket: Date;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  total_request_tokens: number;
  total_response_tokens: number;
  total_tokens: number;
  avg_latency_ms: number;
  min_latency_ms: number;
  max_latency_ms: number;
  error_types: string[];
  created_at: Date;
  updated_at: Date;
}

export interface AIProviderAuditQuery {
  requirement_id?: string;
  user_id?: string;
  provider_type?: string;
  provider_model?: string;
  correlation_id?: string;
  job_id?: string;
  is_successful?: boolean;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
  include_payloads?: boolean; // For security - default false
}

// Persona and Refinement Session types (B-301)
export interface RefinementSession {
  id: string;
  requirement_id: string;
  user_id: string;
  session_name?: string;
  status: 'active' | 'completed' | 'archived';
  session_metadata?: any;
  created_at: Date;
  updated_at: Date;
}

export interface CreateRefinementSessionRequest {
  requirement_id: string;
  session_name?: string;
  status?: 'active' | 'completed' | 'archived';
  session_metadata?: any;
}

export interface RefinementSessionWithDetails extends RefinementSession {
  requirement: Requirement;
  user: User;
}

export interface RefinementMessage {
  id: string;
  session_id: string;
  user_id: string;
  message_type: 'user_message' | 'ai_response' | 'system_message';
  content: string;
  message_metadata?: any;
  created_at: Date;
}

export interface CreateRefinementMessageRequest {
  session_id: string;
  message_type: 'user_message' | 'ai_response' | 'system_message';
  content: string;
  message_metadata?: any;
}

export interface PersonaInvocation {
  id: string;
  requirement_id: string;
  session_id: string;
  user_id: string;
  persona_name: string;
  persona_type?: string;
  persona_description?: string;
  invocation_reason: string;
  trigger_context?: any;
  contributed_dimensions: any[];
  dimension_summary?: string;
  invocation_status: 'pending' | 'completed' | 'failed';
  invocation_metadata?: any;
  invoked_at: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePersonaInvocationRequest {
  requirement_id: string;
  session_id: string;
  persona_name: string;
  persona_type?: string;
  persona_description?: string;
  invocation_reason: string;
  trigger_context?: any;
  contributed_dimensions?: any[];
  dimension_summary?: string;
  invocation_metadata?: any;
}

export interface PersonaInvocationWithDetails extends PersonaInvocation {
  requirement: Requirement;
  session: RefinementSession;
  user: User;
}

export interface PersonaDimensionContribution {
  id: string;
  invocation_id: string;
  dimension_category: string;
  dimension_name: string;
  dimension_value?: string;
  confidence_score?: number;
  contribution_type?: 'addition' | 'modification' | 'validation' | 'concern';
  impact_level?: 'low' | 'medium' | 'high' | 'critical';
  rationale?: string;
  created_at: Date;
}

// Persona Orchestration types (B-302)
export interface PersonaOrchestrationRule {
  id: string;
  rule_name: string;
  rule_type: 'progression' | 'trigger' | 'sequence' | 'conditional';
  description?: string;
  conditions: PersonaRuleCondition[];
  actions: PersonaRuleAction[];
  priority: number; // 1=highest, 5=lowest
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PersonaRuleCondition {
  condition_type: 'persona_invoked' | 'dimension_contributed' | 'session_status' | 'requirement_status' | 'user_action' | 'time_elapsed';
  condition_data: any; // Flexible JSON for condition-specific data
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'exists' | 'not_exists';
  expected_value?: any;
}

export interface PersonaRuleAction {
  action_type: 'invoke_persona' | 'update_session' | 'send_notification' | 'update_requirement' | 'create_task';
  action_data: any; // Flexible JSON for action-specific data
  delay_seconds?: number; // Optional delay before executing action
}

export interface PersonaProgressionConfig {
  id: string;
  progression_name: string;
  description?: string;
  default_sequence: string[]; // Array of persona types in order
  rules: PersonaOrchestrationRule[];
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PersonaOrchestrationExecution {
  id: string;
  rule_id: string;
  requirement_id?: string;
  session_id?: string;
  user_id?: string;
  trigger_event: string;
  trigger_data?: any;
  execution_status: 'pending' | 'executing' | 'completed' | 'failed';
  actions_executed: PersonaExecutedAction[];
  execution_metadata?: any;
  started_at: Date;
  completed_at?: Date;
  error_message?: string;
}

export interface PersonaExecutedAction {
  action_type: string;
  action_data: any;
  execution_status: 'pending' | 'completed' | 'failed';
  executed_at?: Date;
  error_message?: string;
  result_data?: any;
}

// Request/Response DTOs for orchestration
export interface CreateOrchestrationRuleRequest {
  rule_name: string;
  rule_type: 'progression' | 'trigger' | 'sequence' | 'conditional';
  description?: string;
  conditions: PersonaRuleCondition[];
  actions: PersonaRuleAction[];
  priority?: number;
}

export interface UpdateOrchestrationRuleRequest {
  rule_name?: string;
  description?: string;
  conditions?: PersonaRuleCondition[];
  actions?: PersonaRuleAction[];
  priority?: number;
  is_active?: boolean;
}

export interface CreateProgressionConfigRequest {
  progression_name: string;
  description?: string;
  default_sequence: string[];
  is_default?: boolean;
}

export interface TriggerOrchestrationRequest {
  trigger_event: string;
  trigger_data?: any;
  requirement_id?: string;
  session_id?: string;
}