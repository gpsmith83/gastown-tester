import { User, Project } from './workspace.model';

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

export interface RequirementWithDetails extends Requirement {
  project?: Project;
  author?: User;
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

// API Response wrappers
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface RequirementsResponse {
  requirements: RequirementWithDetails[];
  total: number;
  count: number;
}

export interface RequirementResponse {
  requirement: RequirementWithDetails;
  message?: string;
}

// Requirement detail page specific interfaces
export interface RequirementDetailState {
  requirement: RequirementWithDetails | null;
  loading: boolean;
  error: string | null;
}

// Placeholder data for the different sections on the requirement detail page
export interface ConversationSection {
  title: string;
  placeholder: string;
  isEmpty: boolean;
}

export interface SummarySection {
  title: string;
  placeholder: string;
  isEmpty: boolean;
}

// Readiness dimension status
export type ReadinessDimensionStatus = 'complete' | 'partial' | 'missing';

// Individual readiness dimension
export interface ReadinessDimension {
  id: string;
  name: string;
  description: string;
  status: ReadinessDimensionStatus;
  score: number; // 0-100
  missingItems: string[];
}

export interface ReadinessSection {
  title: string;
  placeholder: string;
  status: 'not_started' | 'in_progress' | 'ready' | 'completed';
  dimensions: ReadinessDimension[];
  totalScore: number;
  missingInformation: string[];
  overrides?: ReadinessGateOverride[];
}

// B-306 & B-307: Readiness Gate Override Types
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
  expires_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    username: string;
    email: string;
    name?: string;
    avatar_url?: string;
  };
}

export interface CreateReadinessGateOverrideRequest {
  requirement_id: string;
  dimension_id: string;
  dimension_name: string;
  override_reason: string;
  original_score?: number;
  override_score?: number;
  override_type?: 'manual' | 'automatic' | 'persona_rule';
  expires_at?: string;
}