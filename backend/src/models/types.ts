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

// Export tracking system types (B-507)
export interface ExportJob {
  id: string;
  name: string;
  description?: string;
  export_type: 'requirements' | 'projects' | 'workspace';
  format: 'csv' | 'json' | 'xlsx';

  // Relationships
  user_id: string;
  workspace_id?: string;
  project_id?: string;

  // Export configuration
  filters?: Record<string, any>;
  columns?: string[];
  options?: Record<string, any>;

  // Status tracking
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress_percentage: number;

  // Results and file handling
  file_path?: string;
  file_size_bytes?: number;
  total_records?: number;
  exported_records?: number;

  // Error handling
  error_message?: string;
  error_details?: Record<string, any>;

  // Timing
  started_at?: Date;
  completed_at?: Date;
  expires_at?: Date;

  created_at: Date;
  updated_at: Date;
}

export interface ExportConfirmation {
  id: string;
  export_job_id: string;
  confirmed_by: string;
  confirmation_message?: string;
  satisfaction_rating?: number; // 1-5
  feedback_comment?: string;
  download_count: number;
  last_downloaded_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ExportNotification {
  id: string;
  export_job_id: string;
  recipient_id: string;
  notification_type: 'completed' | 'failed' | 'reminder';
  title: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at?: Date;
  read_at?: Date;
  channels: string[]; // ['web', 'email']
  created_at: Date;
  updated_at: Date;
}

export interface ExportActivityLog {
  id: string;
  export_job_id: string;
  activity_type: 'created' | 'started' | 'progress_updated' | 'completed' | 'failed' | 'downloaded';
  description?: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, any>;
  created_at: Date;
}

// Request/Response DTOs for exports
export interface CreateExportRequest {
  name: string;
  description?: string;
  export_type: 'requirements' | 'projects' | 'workspace';
  format?: 'csv' | 'json' | 'xlsx';
  workspace_id?: string;
  project_id?: string;
  filters?: Record<string, any>;
  columns?: string[];
  options?: Record<string, any>;
}

export interface ExportJobWithDetails extends ExportJob {
  user: User;
  workspace?: Workspace;
  project?: Project;
  confirmation?: ExportConfirmation;
  notifications?: ExportNotification[];
}

export interface ExportConfirmationRequest {
  confirmation_message?: string;
  satisfaction_rating?: number;
  feedback_comment?: string;
}

export interface ExportHistoryResponse {
  exports: ExportJobWithDetails[];
  total: number;
  page: number;
  per_page: number;
}

export interface ExportStatsResponse {
  total_exports: number;
  completed_exports: number;
  failed_exports: number;
  total_size_mb: number;
  avg_satisfaction_rating?: number;
  most_popular_format: string;
  most_popular_type: string;
}// Export batch types (B-503)
export interface ExportBatch {
  id: string;
  project_id: string;
  name: string;
  description?: string;

  // Export target configuration
  target_type: 'linear';
  target_config: any; // JSON configuration for the target (Linear workspace, team, etc.)

  // Batch status and progress
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partially_completed';
  total_items: number;
  processed_items: number;
  failed_items: number;

  // Metadata
  created_by: string; // user_id
  started_at?: Date;
  completed_at?: Date;
  error_message?: string;

  // Settings
  retry_failed: boolean;
  max_retries: number;

  created_at: Date;
  updated_at: Date;
}

export interface ExportBatchItem {
  id: string;
  batch_id: string;
  requirement_id: string;

  // Item status and result
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  external_id?: string; // ID in the target system (e.g., Linear issue ID)
  external_url?: string; // URL in the target system (e.g., Linear issue URL)

  // Error handling
  error_message?: string;
  retry_count: number;
  last_attempted_at?: Date;
  completed_at?: Date;
// Linear issue creation types (B-504)
export interface LinearIssueCreateRequest {
  title: string;
  description?: string;
  teamId: string;
  projectId?: string;
  priority?: number;
  labels?: string[];
  assigneeId?: string;
  stateId?: string;
}

export interface LinearIssueCreateResponse {
  success: boolean;
  issue?: {
    id: string;
    identifier: string; // e.g., "TEAM-123"
    title: string;
    url: string;
  };
  error?: string;
}

export interface LinearExportResult {
  success: boolean;
  issue_id?: string;
  issue_identifier?: string;
  issue_url?: string;
  error?: string;
  retry_recommended?: boolean;
}

// Request/Response DTOs for export batches
export interface CreateExportBatchRequest {
  name: string;
  description?: string;
  requirement_ids: string[];
  target_type: 'linear';
  target_config: {
    workspace_id?: string;
    team_id: string;
    project_id_linear?: string;
    default_priority?: number;
    default_labels?: string[];
  };
  retry_failed?: boolean;
  max_retries?: number;
}

export interface ExportBatchWithItems extends ExportBatch {
  items: ExportBatchItem[];
}

export interface ExportBatchSummary {
  id: string;
  name: string;
  status: string;
  total_items: number;
  processed_items: number;
  failed_items: number;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
