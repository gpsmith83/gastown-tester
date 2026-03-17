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

export interface RequirementFormData {
  prompt: string; // The short freeform prompt
  contextNotes?: string; // Optional context notes
}

export interface RequirementsResponse {
  requirements: RequirementWithDetails[];
  total: number;
}

export interface RequirementResponse {
  requirement: RequirementWithDetails;
  message?: string;
}

// Re-export needed types from workspace model for convenience
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