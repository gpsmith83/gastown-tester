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

// Refinement Session types (B-105/B-202)
export interface RefinementSession {
  id: string;
  requirement_id: string;
  user_id: string;

  // Session metadata
  title?: string;
  description?: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';

  // Session tracking
  started_at: Date;
  completed_at?: Date;

  created_at: Date;
  updated_at: Date;
}

export interface CreateRefinementSessionRequest {
  requirement_id: string;
  title?: string;
  description?: string;
}

export interface RefinementSessionWithDetails extends RefinementSession {
  requirement: RequirementWithDetails;
  user: User;
  message_count?: number;
}

// Requirement Message types (B-105)
export interface RequirementMessage {
  id: string;
  requirement_id: string;
  session_id: string;
  author_id?: string;

  // Message content
  message_type: 'user_message' | 'ai_response' | 'system_note' | 'clarification_request';
  content: string;
  role?: 'user' | 'assistant' | 'system';
  metadata?: any;

  // Ordering and threading
  sequence_number: number;
  parent_message_id?: string;

  created_at: Date;
  updated_at: Date;
}

export interface CreateRequirementMessageRequest {
  requirement_id: string;
  session_id: string;
  message_type?: 'user_message' | 'ai_response' | 'system_note' | 'clarification_request';
  content: string;
  role?: 'user' | 'assistant' | 'system';
  metadata?: any;
  parent_message_id?: string;
}

export interface RequirementMessageWithDetails extends RequirementMessage {
  author?: User;
  requirement: Requirement;
  session: RefinementSession;
}

// Refinement session start flow types (B-202)
export interface StartRefinementRequest {
  requirement_id: string;
  initial_context?: string;
}

export interface StartRefinementResponse {
  session: RefinementSessionWithDetails;
  first_question: RequirementMessage;
  message: string;
}

// Refinement summary types (B-204)
export interface RefinementSummary {
  id: string;
  requirement_id: string;
  session_id: string;

  // Summary content
  title?: string;
  summary: string;
  key_points?: string[];
  clarifications_made?: string[];
  outstanding_questions?: string[];

  // Progress tracking
  message_count: number;
  confidence_score?: number;

  // Summary metadata
  summary_type: 'conversation_progress' | 'final_summary' | 'milestone';
  generated_by: 'ai' | 'user' | 'system';
  version: number;

  // AI generation metadata
  ai_model?: string;
  ai_tokens_used?: number;
  generation_metadata?: any;

  created_at: Date;
  updated_at: Date;
}

export interface CreateRefinementSummaryRequest {
  requirement_id: string;
  session_id: string;
  title?: string;
  summary: string;
  key_points?: string[];
  clarifications_made?: string[];
  outstanding_questions?: string[];
  message_count: number;
  confidence_score?: number;
  summary_type?: 'conversation_progress' | 'final_summary' | 'milestone';
  generated_by?: 'ai' | 'user' | 'system';
  ai_model?: string;
  ai_tokens_used?: number;
  generation_metadata?: any;
}

export interface RefinementSummaryWithDetails extends RefinementSummary {
  requirement: RequirementWithDetails;
  session: RefinementSession;
}

// Requirement readiness types (B-205)
export interface RequirementReadiness {
  id: string;
  requirement_id: string;

  // Readiness dimensions (0.0 to 1.0)
  clarity_score: number;
  completeness_score: number;
  testability_score: number;
  feasibility_score: number;
  specificity_score: number;

  // Overall assessment
  overall_score: number;
  readiness_level: 'not_ready' | 'partially_ready' | 'ready' | 'fully_ready';

  // Analysis metadata
  analysis_source: 'ai_analysis' | 'manual_review' | 'hybrid';
  confidence_score?: number;
  missing_areas?: string[];
  recommendations?: string[];

  // Computation metadata
  computed_from_summary_id?: string;
  computation_version: number;
  ai_model?: string;
  analysis_metadata?: any;

  created_at: Date;
  updated_at: Date;
}

export interface CreateRequirementReadinessRequest {
  requirement_id: string;
  clarity_score: number;
  completeness_score: number;
  testability_score: number;
  feasibility_score: number;
  specificity_score: number;
  overall_score?: number; // Can be computed if not provided
  readiness_level?: 'not_ready' | 'partially_ready' | 'ready' | 'fully_ready'; // Can be computed
  analysis_source?: 'ai_analysis' | 'manual_review' | 'hybrid';
  confidence_score?: number;
  missing_areas?: string[];
  recommendations?: string[];
  computed_from_summary_id?: string;
  ai_model?: string;
  analysis_metadata?: any;
}

export interface RequirementReadinessWithDetails extends RequirementReadiness {
  requirement: RequirementWithDetails;
  computed_from_summary?: RefinementSummary;
}

// Readiness gate types (B-305)
export interface ReadinessGateResult {
  requirement_id: string;
  gate_passed: boolean;
  overall_score: number;
  readiness_level: 'not_ready' | 'partially_ready' | 'ready' | 'fully_ready';

  // Dimension checks
  blocking_dimensions: string[]; // Names of dimensions that failed gate
  dimension_scores: {
    clarity_score: number;
    completeness_score: number;
    testability_score: number;
    feasibility_score: number;
    specificity_score: number;
  };

  // Gate rules applied
  gate_rules_applied: ReadinessGateRules;

  // Override status
  has_active_override: boolean;
  override_details?: ReadinessGateOverride;

  // Analysis metadata
  confidence_score?: number;
  missing_areas?: string[];
  recommendations?: string[];

  checked_at: Date;
}

export interface ReadinessGateRules {
  // Minimum overall score required
  minimum_overall_score: number;

  // Minimum scores required for specific dimensions (hard gates)
  minimum_clarity_score: number;
  minimum_completeness_score: number;
  minimum_testability_score: number;
  minimum_feasibility_score: number;
  minimum_specificity_score: number;

  // Alternative: minimum readiness level
  minimum_readiness_level: 'not_ready' | 'partially_ready' | 'ready' | 'fully_ready';
}

export interface ReadinessGateOverride {
  id: string;
  requirement_id: string;

  // Override details
  override_type: 'manual_approval' | 'emergency_bypass' | 'stakeholder_decision';
  override_reason: string;
  overridden_by: string;

  // Gate state at time of override
  gate_check_result?: any;
  readiness_score_at_override: number;
  blocking_dimensions?: string[];

  // Override metadata
  is_active: boolean;
  valid_until?: Date;
  conditions?: string;

  // Approval workflow
  approval_status: 'pending' | 'granted' | 'revoked';
  approved_by?: string;

  created_at: Date;
  updated_at: Date;
}

export interface CreateReadinessGateOverrideRequest {
  requirement_id: string;
  override_type: 'manual_approval' | 'emergency_bypass' | 'stakeholder_decision';
  override_reason: string;
  gate_check_result?: any;
  readiness_score_at_override?: number; // Will be computed by service if not provided
  blocking_dimensions?: string[];
  valid_until?: Date;
  conditions?: string;
}

export interface ReadinessGateOverrideWithDetails extends ReadinessGateOverride {
  requirement: RequirementWithDetails;
  overridden_by_user?: User;
  approved_by_user?: User;
}