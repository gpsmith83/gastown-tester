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

// Refinement Session types
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

// Requirement Message types
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

export interface UpdateRequirementMessageRequest {
  content?: string;
  metadata?: any;
}

export interface RequirementMessageWithDetails extends RequirementMessage {
  author?: User;
  requirement: Requirement;
  session: RefinementSession;
  replies?: RequirementMessage[];
}