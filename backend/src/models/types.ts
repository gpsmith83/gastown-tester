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