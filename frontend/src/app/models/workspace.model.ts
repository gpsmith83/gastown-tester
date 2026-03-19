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
  user?: User;
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

export interface WorkspaceWithProjects extends Workspace {
  projects?: Project[];
  member_count?: number;
}

export interface ProjectWithDetails extends Project {
  workspace?: Workspace;
  owner?: User;
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

// API Response wrappers
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface WorkspacesResponse {
  workspaces: WorkspaceWithProjects[];
  total: number;
}

export interface ProjectsResponse {
  projects: ProjectWithDetails[];
  total: number;
}

// Persona progression types (B-302)
export interface PersonaProgressionHistory {
  id: string;
  project_id: string;
  user_id: string;
  session_id: string;
  session_type: 'refinement' | 'guidance' | 'validation' | 'selection' | 'custom';
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
  created_at: Date;
  updated_at: Date;
}

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

export interface SpecialistUsageStats {
  specialist: string;
  usage_count: number;
  success_rate: number;
  average_score: number;
}

export interface PersonaProgressionAnalytics {
  project_id: string;
  total_sessions: number;
  completion_rate: number;
  average_session_duration: number;
  most_used_specialists: SpecialistUsageStats[];
  progression_trends: Array<{
    stage: string;
    average_score: number;
    completion_rate: number;
  }>;
}