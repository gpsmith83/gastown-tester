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

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
}

export interface WorkspaceWithProjects extends Workspace {
  project_count: number;
  member_count: number;
  projects?: Project[];
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
  status?: 'active' | 'archived' | 'draft';
  settings?: any;
}

export interface ProjectWithRepository extends Project {
  repository?: any;
}

export interface ProjectWithLinearConnection extends Project {
  linear_connection?: any;
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

export interface ProjectWithDetails extends Project {
  workspace: Workspace;
  owner: User;
  members?: ProjectMember[];
}

export interface GitHubRepository {
  id: string;
  project_id: string;
  github_repo_id: number;
  owner: string;
  name: string;
  full_name: string;
  description?: string;
  url: string;
  clone_url: string;
  ssh_url: string;
  private: boolean;
  default_branch: string;
  language?: string;
  topics: string[];
  access_level: 'read' | 'write' | 'admin';
  webhook_configured: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Requirement {
  id: string;
  title: string;
  description?: string;
  project_id: string;
  author_id: string;
  assignee_id?: string;
  priority: number; // 1=highest, 5=lowest
  priority_label?: string;
  type: 'feature' | 'bug' | 'enhancement' | 'epic';
  status: 'draft' | 'active' | 'in_progress' | 'completed' | 'archived';
  github_issue_number?: number;
  github_issue_url?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RequirementWithDetails extends Requirement {
  project: Project;
  author: User;
}

export interface RequirementWorkflowDetails extends RequirementWithDetails {
  assignee?: User;
  workflow_state?: string;
  workflow_metadata?: any;
}

export interface CreateRequirementRequest {
  title: string;
  description?: string;
  project_id: string;
  priority?: number;
  type?: 'feature' | 'bug' | 'enhancement' | 'epic';
  status?: 'draft' | 'active' | 'completed' | 'archived';
  assignee_id?: string;
  github_issue_number?: number;
  github_issue_url?: string;
}

export interface CreateRequirementAdvancedRequest extends CreateRequirementRequest {
  workflow_state?: string;
  workflow_metadata?: any;
  labels?: string[];
  estimated_effort?: string;
  priority_label?: string;
  due_date?: Date;
  estimated_hours?: number;
  story_points?: number;
  metadata?: any;
  watchers?: string[];
}

export interface UpdateRequirementRequest {
  title?: string;
  description?: string;
  priority?: number;
  type?: 'feature' | 'bug' | 'enhancement' | 'epic';
  status?: 'draft' | 'active' | 'completed' | 'archived';
  assignee_id?: string;
  github_issue_number?: number;
  github_issue_url?: string;
  is_active?: boolean;
}

export interface UpdateRequirementAssignmentRequest {
  assignee_id?: string;
  workflow_state?: string;
  notes?: string;
  change_reason?: string;
}

export interface UpdateRequirementStatusRequest {
  status: 'draft' | 'active' | 'in_progress' | 'completed' | 'archived';
  notes?: string;
  workflow_metadata?: any;
  resolution?: string;
  resolution_notes?: string;
  change_reason?: string;
}

export interface UpdateRequirementPriorityRequest {
  priority: number;
  priority_label?: string;
  notes?: string;
  urgency_score?: number;
  due_date?: Date;
  change_reason?: string;
}

export interface UpdateRequirementLifecycleRequest {
  is_active: boolean;
  archived_reason?: string;
  notes?: string;
  estimated_hours?: number;
  actual_hours?: number;
  story_points?: number;
  labels?: string[];
  metadata?: any;
}

export interface RequirementHistory {
  id: string;
  requirement_id: string;
  user_id: string;
  action: string;
  field_name?: string;
  old_value?: any;
  new_value?: any;
  change_reason?: string;
  metadata?: any;
  created_at: Date;
}

export interface RequirementHistoryWithUser extends RequirementHistory {
  user: User;
}

export interface RequirementComment {
  id: string;
  requirement_id: string;
  author_id: string;
  content: string;
  comment_type?: string;
  is_internal?: boolean;
  metadata?: any;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RequirementCommentWithAuthor extends RequirementComment {
  author: User;
}

export interface CreateRequirementCommentRequest {
  requirement_id: string;
  content: string;
  comment_type?: string;
  is_internal?: boolean;
  metadata?: any;
}

export interface RequirementCommentData {
  content: string;
  comment_type?: string;
  is_internal?: boolean;
  metadata?: any;
}

export interface RequirementWatcher {
  id: string;
  requirement_id: string;
  user_id: string;
  notification_preferences?: any;
  is_active: boolean;
  created_at: Date;
}

export interface RequirementWatcherWithUser extends RequirementWatcher {
  user: User;
}

export interface RequirementDependency {
  id: string;
  requirement_id: string;
  depends_on_requirement_id: string;
  dependency_type: 'blocks' | 'follows' | 'related';
  is_active: boolean;
  created_at: Date;
}

export interface RequirementDependencyWithDetails extends RequirementDependency {
  requirement: Requirement;
  depends_on_requirement: Requirement;
}

export interface TicketCandidate {
  id: string;
  title: string;
  description?: string;
  requirement_id: string;
  author_id: string;
  priority: number; // 1=highest, 5=lowest
  status: 'draft' | 'review' | 'approved' | 'rejected' | 'archived';
  order_index: number; // For ordering within a requirement
  metadata?: string; // JSON string for additional metadata
  estimated_effort?: string; // e.g., 'small', 'medium', 'large', or story points
  labels?: string; // JSON array of labels/tags
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TicketCandidateWithDetails extends TicketCandidate {
  requirement: Requirement;
  author: User;
}

// Request/Response DTOs for ticket candidates
export interface CreateTicketCandidateRequest {
  title: string;
  description?: string;
  requirement_id: string;
  priority?: number;
  status?: 'draft' | 'review' | 'approved' | 'rejected' | 'archived';
  order_index?: number;
  metadata?: any; // Will be JSON stringified
  estimated_effort?: string;
  labels?: string[];
}

export interface CreateLinearConnectionRequest {
  api_token: string;
  workspace_id: string;
  team_id: string;
  board_id?: string;
  project_id_linear?: string;
}

export interface LinearConnection {
  id: string;
  project_id: string;
  api_token: string; // encrypted in storage
  api_token_hash: string; // hash of the API token
  workspace_id: string;
  team_id: string;
  board_id?: string;
  project_id_linear?: string;
  is_active: boolean;
  last_sync_at?: Date;
  sync_status?: 'pending' | 'syncing' | 'completed' | 'failed';
  sync_error?: string;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateLinearConnectionRequest {
  api_token?: string;
  workspace_id?: string;
  team_id?: string;
  board_id?: string;
  project_id_linear?: string;
  is_active?: boolean;
}

export interface LinearConnectionValidationResult {
  is_valid: boolean;
  error?: string;
  workspace?: {
    id?: string;
    name?: string;
  };
  team?: {
    id?: string;
    name?: string;
  };
  board?: {
    id?: string;
    name?: string;
  };
  project?: {
    id?: string;
    name?: string;
  };
  organization?: {
    id?: string;
    name?: string;
  };
  permissions?: any[];
}

export interface LinearIssue {
  id: string;
  linear_issue_id: string;
  linear_connection_id: string;
  ticket_candidate_id?: string;
  requirement_id?: string;
  title: string;
  description?: string;
  status: string;
  priority: number;
  assignee_id?: string;
  assignee_name?: string;
  labels: string[];
  created_at: Date;
  updated_at: Date;
  synced_at: Date;
}

export interface CreateRequirementRequest {
  title: string;
  description?: string;
  project_id: string;
  priority?: number;
  type?: 'feature' | 'bug' | 'enhancement' | 'epic';
  status?: 'draft' | 'active';
  github_issue_number?: number;
  github_issue_url?: string;
}

export interface UpdateRequirementRequest {
  title?: string;
  description?: string;
  priority?: number;
  type?: 'feature' | 'bug' | 'enhancement' | 'epic';
  status?: 'draft' | 'active' | 'completed' | 'archived';
  github_issue_number?: number;
  github_issue_url?: string;
}

export interface ContextSource {
  id: string;
  project_id: string;
  source_type: 'github_repository' | 'file_upload' | 'manual_entry';
  source_identifier: string; // Repository URL, file path, or manual identifier
  name: string;
  description?: string;
  metadata: any; // JSON object with source-specific data
  is_active: boolean;
  last_indexed_at?: Date;
  indexing_status: 'pending' | 'indexing' | 'completed' | 'failed';
  indexing_error?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ContextFile {
  id: string;
  context_source_id: string;
  file_path: string;
  file_content: string;
  file_type: string;
  file_size: number;
  content_hash: string;
  is_selected: boolean; // Whether this file is selected for context
  last_modified_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateContextSourceRequest {
  project_id: string;
  source_type: 'github_repository' | 'file_upload' | 'manual_entry';
  source_identifier: string;
  name: string;
  description?: string;
  metadata?: any;
}

export interface UpdateContextSourceRequest {
  name?: string;
  description?: string;
  metadata?: any;
  is_active?: boolean;
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
  is_successful: boolean;
  error_type?: string;
  error_message?: string;
  error_details?: any;
  request_timestamp?: Date;
  response_timestamp?: Date;
}

export interface UpdateAIProviderAuditRequest {
  response_payload?: any;
  response_status?: number;
  request_tokens?: number;
  response_tokens?: number;
  total_tokens?: number;
  latency_ms?: number;
  is_successful?: boolean;
  error_type?: string;
  error_message?: string;
  error_details?: any;
  response_timestamp?: Date;
}

// Refinement Session types
export interface RefinementSession {
  id: string;
  requirement_id: string;
  user_id: string;
  title?: string;
  description?: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  started_at: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;

  // Legacy compatibility fields
  session_name?: string;
  session_metadata?: any;
}

export interface CreateRefinementSessionRequest {
  requirement_id: string;
  title?: string;
  description?: string;
  status?: 'active' | 'completed' | 'paused' | 'cancelled';

  // Legacy compatibility fields
  session_name?: string;
  session_metadata?: any;
}

export interface UpdateRefinementSessionRequest {
  title?: string;
  description?: string;
  status?: 'active' | 'completed' | 'paused' | 'cancelled';
}

export interface RefinementSessionWithDetails extends RefinementSession {
  requirement: RequirementWithDetails;
  user: User;
  message_count?: number;
}

// Requirement message types (conversation in refinement sessions)
export interface RefinementMessage {
  id: string;
  session_id: string;
  user_id: string;
  message_type: 'user_message' | 'ai_response' | 'system_note' | 'clarification_request';
  content: string;
  message_metadata?: any;
  created_at: Date;
  updated_at: Date;
}

export interface CreateRefinementMessageRequest {
  session_id: string;
  message_type: 'user_message' | 'ai_response' | 'system_note' | 'clarification_request';
  content: string;
  message_metadata?: any;
}

export interface RequirementMessage {
  id: string;
  requirement_id: string;
  session_id: string;
  author_id?: string;
  message_type: 'user_message' | 'ai_response' | 'system_note' | 'clarification_request';
  content: string;
  role?: 'user' | 'assistant' | 'system';
  metadata?: any;
  sequence_number: number;
  parent_message_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateRequirementMessageRequest {
  requirement_id: string;
  session_id: string;
  message_type: 'user_message' | 'ai_response' | 'system_note' | 'clarification_request';
  content: string;
  role?: 'user' | 'assistant' | 'system';
  metadata?: any;
  parent_message_id?: string;
}

// Job system types
export interface Job {
  id: string;
  job_type: string;
  project_id?: string;
  user_id?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  payload: any;
  result?: any;
  error?: string;
  priority: number; // Higher number = higher priority
  max_retries: number;
  retry_count: number;
  retry_delay_ms: number;
  scheduled_for?: Date;
  started_at?: Date;
  completed_at?: Date;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateJobRequest {
  job_type: string;
  project_id?: string;
  payload: any;
  priority?: number;
  max_retries?: number;
  retry_delay_ms?: number;
  scheduled_for?: Date;
  expires_at?: Date;
}

export interface UpdateJobRequest {
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: any;
  error?: string;
  retry_count?: number;
  started_at?: Date;
  completed_at?: Date;
}

// Persona types from persona progression service
export interface PersonaType {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  capabilities: string[];
  triggers: PersonaTrigger[];
  parameters: PersonaParameter[];
}

export interface PersonaTrigger {
  event: string;
  condition?: string;
  priority: number;
}

export interface PersonaParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  required: boolean;
  description: string;
  defaultValue?: any;
}

export interface PersonaStack {
  personas: PersonaType[];
  context?: any;
  metadata?: any;
}

export interface PersonaRecommendation {
  persona: PersonaType;
  confidence: number;
  reasoning: string;
  metadata?: any;
}

export interface PersonaProgressionHistory {
  id: string;
  project_id: string;
  user_id: string;
  session_id: string;
  session_type: string;
  specialist_selected?: string;
  specialist_reason?: string;
  previous_specialists?: string[];
  refinement_stage?: string;
  refinement_outcome?: string;
  outcome_data?: any;
  current_persona_stack?: any;
  progression_context?: any;
  progression_score?: number;
  time_spent_minutes?: number;
  user_satisfaction?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePersonaProgressionHistoryRequest {
  session_id: string;
  session_type?: string;
  specialist_selected?: string;
  specialist_reason?: string;
  previous_specialists?: string[];
  refinement_stage?: string;
  refinement_outcome?: string;
  outcome_data?: any;
  current_persona_stack?: any;
  progression_context?: any;
  progression_score?: number;
  time_spent_minutes?: number;
  user_satisfaction?: number;
}

// Common response wrappers
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Health check and monitoring
export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  services: {
    database: 'up' | 'down';
    ai_provider: 'up' | 'down';
    external_apis: 'up' | 'down';
  };
  version: string;
}