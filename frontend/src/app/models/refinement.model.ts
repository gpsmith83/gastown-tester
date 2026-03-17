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
}

export interface RefinementSessionWithDetails extends RefinementSession {
  requirement: RequirementWithDetails;
  user: User;
  message_count?: number;
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

export interface RequirementMessageWithDetails extends RequirementMessage {
  author?: User;
  requirement: Requirement;
  session: RefinementSession;
}

export interface StartRefinementRequest {
  requirement_id: string;
  initial_context?: string;
}

export interface StartRefinementResponse {
  session: RefinementSessionWithDetails;
  first_question: RequirementMessageWithDetails;
  message: string;
}

export interface CreateMessageRequest {
  content: string;
  message_type?: 'user_message' | 'ai_response' | 'system_note' | 'clarification_request';
  metadata?: any;
}

export interface CreateMessageResponse {
  userMessage: RequirementMessageWithDetails;
  aiResponse?: RequirementMessageWithDetails;
  summaryGenerated?: boolean;
  summaryId?: string;
  message: string;
  aiError?: string;
}

// Summary types (B-204)
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

export interface RequirementReadinessWithDetails extends RequirementReadiness {
  requirement: RequirementWithDetails;
  computed_from_summary?: RefinementSummary;
}

export interface ProjectReadinessStats {
  total_requirements: number;
  not_ready: number;
  partially_ready: number;
  ready: number;
  fully_ready: number;
  average_score: number;
}

// Readiness gate types (B-305)
export interface ReadinessGateResult {
  requirement_id: string;
  gate_passed: boolean;
  overall_score: number;
  readiness_level: 'not_ready' | 'partially_ready' | 'ready' | 'fully_ready';

  // Dimension checks
  blocking_dimensions: string[];
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
  minimum_overall_score: number;
  minimum_clarity_score: number;
  minimum_completeness_score: number;
  minimum_testability_score: number;
  minimum_feasibility_score: number;
  minimum_specificity_score: number;
  minimum_readiness_level: 'not_ready' | 'partially_ready' | 'ready' | 'fully_ready';
}

export interface ReadinessGateOverride {
  id: string;
  requirement_id: string;
  override_type: 'manual_approval' | 'emergency_bypass' | 'stakeholder_decision';
  override_reason: string;
  overridden_by: string;
  gate_check_result?: any;
  readiness_score_at_override: number;
  blocking_dimensions?: string[];
  is_active: boolean;
  valid_until?: Date;
  conditions?: string;
  approval_status: 'pending' | 'granted' | 'revoked';
  approved_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ReadinessGateOverrideWithDetails extends ReadinessGateOverride {
  requirement: RequirementWithDetails;
  overridden_by_user?: User;
  approved_by_user?: User;
}

export interface CreateReadinessGateOverrideRequest {
  override_type: 'manual_approval' | 'emergency_bypass' | 'stakeholder_decision';
  override_reason: string;
  valid_until?: Date;
  conditions?: string;
}

export interface ProjectGateResults {
  project_id: string;
  gate_results: ReadinessGateResult[];
  summary: {
    total_requirements: number;
    passed_gate: number;
    failed_gate: number;
    with_overrides: number;
  };
}

// Re-export needed types from requirement model for convenience
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

export interface Requirement {
  id: string;
  title: string;
  description?: string;
  project_id: string;
  author_id: string;
  priority: number;
  status: 'draft' | 'active' | 'completed' | 'archived';
  type: 'feature' | 'bug' | 'enhancement' | 'epic';
  github_issue_number?: number;
  github_issue_url?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RequirementWithDetails extends Requirement {
  project?: Project;
  author?: User;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  workspace_id: string;
  owner_id: string;
  product_area?: string;
  goals?: string[];
  default_labels?: any[];
  default_persona_stack?: any;
  status: 'active' | 'archived' | 'draft';
  settings?: any;
  created_at: Date;
  updated_at: Date;
}