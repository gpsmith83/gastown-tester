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
  status: 'draft' | 'open' | 'in_progress' | 'in_review' | 'testing' | 'blocked' | 'completed' | 'archived' | 'cancelled';
  type: 'feature' | 'bug' | 'enhancement' | 'epic';
  github_issue_number?: number;
  github_issue_url?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;

  // B-405: Assignment fields
  assignee_id?: string;
  assigned_at?: Date;
  assigned_by?: string;

  // B-406: Advanced prioritization
  priority_label?: 'critical' | 'high' | 'medium' | 'low' | 'backlog';
  due_date?: Date;
  urgency_score?: number; // 0-100 calculated urgency

  // B-407: Lifecycle management
  estimated_hours?: number;
  actual_hours?: number;
  story_points?: number;
  started_at?: Date;
  completed_at?: Date;
  resolution?: 'done' | 'wont_fix' | 'duplicate' | 'invalid';
  resolution_notes?: string;
  labels?: string[];
  metadata?: any;
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

// Persona progression types (B-302)
export interface PersonaProgressionHistory {
  id: string;
  project_id: string;
  user_id: string;

  // Progression session metadata
  session_id: string;
  session_type: 'refinement' | 'guidance' | 'validation' | 'selection' | 'custom';

  // Specialist selection tracking
  specialist_selected?: string;
  specialist_reason?: string;
  previous_specialists?: string[];

  // Refinement outcome tracking
  refinement_stage?: string;
  refinement_outcome?: 'completed' | 'in_progress' | 'abandoned' | 'escalated';
  outcome_data?: any;

  // Progression context
  current_persona_stack?: any;
  progression_context?: any;

  // Metrics and scoring
  progression_score?: number;
  time_spent_minutes?: number;
  user_satisfaction?: number;

  created_at: Date;
  updated_at: Date;
}

// Export batch system types (B-503, B-505, B-506)
export interface ExportBatch {
  id: string;
  project_id: string;

  // Batch metadata
  type: 'github_issues' | 'linear_issues';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';

  // Export configuration
  target_service: 'github' | 'linear';
  target_config: Record<string, any>; // service-specific config

  // Progress tracking
  total_items: number;
  processed_items: number;
  failed_items: number;

  // Retry configuration
  max_retries: number;
  retry_count: number;
  retry_delay_seconds: number;

  // Result tracking
  results: Record<string, any>; // stores export results and errors
  error_message?: string;

  // Timing
  started_at?: Date;
  completed_at?: Date;
  next_retry_at?: Date;

  created_at: Date;
  updated_at: Date;
}

export interface ExportBatchItem {
  id: string;
  batch_id: string;

  // Source item reference
  source_type: 'requirement';
  source_id: string;

  // Export status
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

  // Retry tracking
  retry_count: number;

  // Results
  external_id?: string; // e.g., GitHub issue number
  external_url?: string; // e.g., GitHub issue URL
  export_data: Record<string, any>; // exported data
  error_message?: string;

  // Timing
  started_at?: Date;
  completed_at?: Date;

  created_at: Date;
  updated_at: Date;
}

// Ticket types
export interface Ticket {
  id: string;
  title: string;
  description?: string;
  project_id: string;
  assignee_id?: string;
  author_id: string;
  priority: number; // 1=highest, 5=lowest
  status: 'open' | 'in_progress' | 'completed' | 'closed' | 'cancelled';
  type: 'bug' | 'feature' | 'task' | 'enhancement';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

<<<<<<< HEAD
// B-306: Readiness Gate Override Types
export interface ReadinessGateOverride {
  id: string;
  requirement_id: string;
  user_id: string;
  dimension_id: string;
  dimension_name: string;
  override_reason: string;
  original_score: number;
  override_score: number;
  override_type: 'manual' | 'automatic' | 'persona_rule';
  expires_at?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ReadinessGateOverrideWithUser extends ReadinessGateOverride {
  user: User;
}

export interface PersonaProgressionGate {
  id: string;
  project_id: string;
  gate_name: string;
  gate_description?: string;
  required_dimensions: string[];
  minimum_score: number;
  allow_overrides: boolean;
  persona_type?: string;
  gate_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Advanced ticket workflow types (B-404, B-405, B-406, B-407)
export interface RequirementComment {
  id: string;
  requirement_id: string;
  author_id: string;
  content: string;
  comment_type: 'comment' | 'status_change' | 'assignment_change' | 'priority_change';
  metadata?: any;
  is_internal: boolean;
  created_at: Date;
  updated_at: Date;
}

<<<<<<< HEAD
export interface CreatePersonaProgressionRequest {
  project_id: string;
  session_id: string;
  session_type?: 'refinement' | 'guidance' | 'validation' | 'selection' | 'custom';
  specialist_selected?: string;
  specialist_reason?: string;
  previous_specialists?: string[];
  refinement_stage?: string;
  refinement_outcome?: 'completed' | 'in_progress' | 'abandoned' | 'escalated';
  outcome_data?: any;
  current_persona_stack?: any;
  progression_context?: any;
  progression_score?: number;
  time_spent_minutes?: number;
  user_satisfaction?: number;
}

export interface UpdatePersonaProgressionRequest {
  specialist_selected?: string;
  specialist_reason?: string;
  previous_specialists?: string[];
  refinement_stage?: string;
  refinement_outcome?: 'completed' | 'in_progress' | 'abandoned' | 'escalated';
  outcome_data?: any;
  current_persona_stack?: any;
  progression_context?: any;
  progression_score?: number;
  time_spent_minutes?: number;
  user_satisfaction?: number;
}

export interface PersonaProgressionSession {
  session_id: string;
  project_id: string;
  user_id: string;
  session_type: string;
  history: PersonaProgressionHistory[];
  current_specialist?: string;
  progression_stats: {
    total_steps: number;
    completed_steps: number;
    average_score?: number;
    total_time_minutes: number;
  };
  started_at: Date;
  last_activity: Date;
}

export interface PersonaProgressionAnalytics {
  project_id: string;
  total_sessions: number;
  completion_rate: number;
  average_session_duration: number;
  most_used_specialists: Array<{
    specialist: string;
    usage_count: number;
    success_rate: number;
  }>;
  progression_trends: Array<{
    stage: string;
    average_score: number;
    completion_rate: number;
  }>;
}

export interface CreateTicketRequest {
  title: string;
  description?: string;
  project_id: string;
  assignee_id?: string;
  priority?: number;
  type?: 'bug' | 'feature' | 'task' | 'enhancement';
}

export interface TicketWithDetails extends Ticket {
  project: Project;
  author: User;
  assignee?: User;
}

export interface RequirementCommentWithAuthor extends RequirementComment {
  author: User;
}

export interface RequirementHistory {
  id: string;
  requirement_id: string;
  changed_by: string;
  field_name: string;
  old_value?: string;
  new_value?: string;
  change_reason?: string;
  created_at: Date;
}

export interface RequirementHistoryWithUser extends RequirementHistory {
  user: User;
}

export interface RequirementWatcher {
  id: string;
  requirement_id: string;
  user_id: string;
  watch_type: 'all' | 'mentions' | 'status_changes';
  created_at: Date;
}

export interface RequirementWatcherWithUser extends RequirementWatcher {
  user: User;
}

export interface RequirementDependency {
  id: string;
  requirement_id: string;
  dependency_id: string;
  dependency_type: 'blocks' | 'relates_to' | 'duplicate_of';
  created_by: string;
  created_at: Date;
}

export interface RequirementDependencyWithDetails extends RequirementDependency {
  dependency: Requirement;
  created_by_user: User;
}

// Extended requirement with full details for workflow management
export interface RequirementWorkflowDetails extends RequirementWithDetails {
  assignee?: User;
  assigned_by_user?: User;
  comments: RequirementCommentWithAuthor[];
  watchers: RequirementWatcherWithUser[];
  dependencies: RequirementDependencyWithDetails[];
  blocking: RequirementDependencyWithDetails[]; // Requirements this one blocks
  history: RequirementHistoryWithUser[];
}

// Request DTOs for advanced workflow features
export interface CreateRequirementCommentRequest {
  content: string;
  comment_type?: 'comment' | 'status_change' | 'assignment_change' | 'priority_change';
  is_internal?: boolean;
  metadata?: any;
}

export interface UpdateRequirementAssignmentRequest {
  assignee_id?: string;
  change_reason?: string;
}

export interface UpdateRequirementStatusRequest {
  status: 'draft' | 'open' | 'in_progress' | 'in_review' | 'testing' | 'blocked' | 'completed' | 'archived' | 'cancelled';
  resolution?: 'done' | 'wont_fix' | 'duplicate' | 'invalid';
  resolution_notes?: string;
  change_reason?: string;
}

export interface UpdateRequirementPriorityRequest {
  priority?: number;
  priority_label?: 'critical' | 'high' | 'medium' | 'low' | 'backlog';
  urgency_score?: number;
  due_date?: string; // ISO date string
  change_reason?: string;
}

export interface UpdateRequirementLifecycleRequest {
  estimated_hours?: number;
  actual_hours?: number;
  story_points?: number;
  labels?: string[];
  metadata?: any;
}

export interface CreateRequirementDependencyRequest {
  dependency_id: string;
  dependency_type: 'blocks' | 'relates_to' | 'duplicate_of';
}

export interface AddRequirementWatcherRequest {
  watch_type?: 'all' | 'mentions' | 'status_changes';
}

// Enhanced requirement creation request with new fields
export interface CreateRequirementAdvancedRequest extends CreateRequirementRequest {
  assignee_id?: string;
  priority_label?: 'critical' | 'high' | 'medium' | 'low' | 'backlog';
  due_date?: string;
  estimated_hours?: number;
  story_points?: number;
  labels?: string[];
  watchers?: string[]; // User IDs to automatically watch this requirement
  metadata?: any;
}

// Request/Response DTOs for readiness gate overrides
export interface CreateReadinessGateOverrideRequest {
  requirement_id: string;
  dimension_id: string;
  dimension_name: string;
  override_reason: string;
  original_score?: number;
  override_score?: number;
  override_type?: 'manual' | 'automatic' | 'persona_rule';
  expires_at?: Date;
}

export interface UpdateReadinessGateOverrideRequest {
  override_reason?: string;
  override_score?: number;
  expires_at?: Date;
  is_active?: boolean;
}

export interface CreatePersonaProgressionGateRequest {
  project_id: string;
  gate_name: string;
  gate_description?: string;
  required_dimensions?: string[];
  minimum_score?: number;
  allow_overrides?: boolean;
  persona_type?: string;
  gate_order?: number;
}

export interface UpdatePersonaProgressionGateRequest {
  gate_name?: string;
  gate_description?: string;
  required_dimensions?: string[];
  minimum_score?: number;
  allow_overrides?: boolean;
  persona_type?: string;
  gate_order?: number;
  is_active?: boolean;
}

// Request/Response DTOs for export batches
export interface CreateExportBatchRequest {
  project_id: string;
  type: 'github_issues' | 'linear_issues';
  target_service: 'github' | 'linear';
  target_config: Record<string, any>;
  requirement_ids?: string[]; // If specified, only export these requirements
  max_retries?: number;
  retry_delay_seconds?: number;
}

export interface ExportBatchProgress {
  batch_id: string;
  status: string;
  progress: {
    total_items: number;
    processed_items: number;
    failed_items: number;
    percentage: number;
  };
  current_item?: string;
  estimated_completion?: Date;
}

export interface GitHubExportConfig {
  repository: {
    owner: string;
    name: string;
  };
  labels?: string[];
  assignees?: string[];
  milestone?: string;
  template?: {
    title_prefix?: string;
    body_template?: string;
  };
}

export interface LinearExportConfig {
  workspace_id: string;
  team_id: string;
  project_id?: string;
  labels?: string[];
  assignee_id?: string;
  template?: {
    title_prefix?: string;
    description_template?: string;
  };
}
