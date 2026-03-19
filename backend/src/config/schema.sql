-- Gastown Tester Database Schema
-- Run this script to initialize the database schema

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(255),
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workspace members table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member', -- owner, admin, member
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Project metadata fields as specified in B-005
    product_area VARCHAR(255),
    goals TEXT[],
    default_labels JSONB DEFAULT '[]'::jsonb,
    default_persona_stack JSONB,

    -- Additional metadata
    status VARCHAR(50) DEFAULT 'active', -- active, archived, draft
    settings JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project members table (optional - projects inherit workspace membership by default)
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member', -- owner, admin, member
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- GitHub repository connections table
CREATE TABLE IF NOT EXISTS github_repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

    -- GitHub repository metadata
    github_repo_id BIGINT NOT NULL,
    owner VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    description TEXT,
    url VARCHAR(500) NOT NULL,
    clone_url VARCHAR(500) NOT NULL,
    ssh_url VARCHAR(500) NOT NULL,

    -- Repository details
    private BOOLEAN DEFAULT false,
    default_branch VARCHAR(255) DEFAULT 'main',
    language VARCHAR(100),
    topics TEXT[],

    -- Access configuration
    access_level VARCHAR(50) DEFAULT 'read', -- read, write, admin
    webhook_configured BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure one repo per project for now
    UNIQUE(project_id),
    -- Ensure same GitHub repo isn't connected to multiple projects
    UNIQUE(github_repo_id)
);

-- Requirements table
CREATE TABLE IF NOT EXISTS requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    priority INT DEFAULT 3, -- 1=highest, 5=lowest
    type VARCHAR(50) DEFAULT 'feature', -- feature, bug, enhancement, epic
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, completed, archived
    github_issue_number INT,
    github_issue_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_github_repositories_project_id ON github_repositories(project_id);
CREATE INDEX IF NOT EXISTS idx_github_repositories_github_repo_id ON github_repositories(github_repo_id);
CREATE INDEX IF NOT EXISTS idx_github_repositories_owner ON github_repositories(owner);
CREATE INDEX IF NOT EXISTS idx_github_repositories_full_name ON github_repositories(full_name);
CREATE INDEX IF NOT EXISTS idx_requirements_project_id ON requirements(project_id);
CREATE INDEX IF NOT EXISTS idx_requirements_author_id ON requirements(author_id);
CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status);
CREATE INDEX IF NOT EXISTS idx_requirements_is_active ON requirements(is_active);
CREATE INDEX IF NOT EXISTS idx_requirements_priority ON requirements(priority);

-- Persona progression history table (B-302)
CREATE TABLE IF NOT EXISTS persona_progression_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Progression session metadata
    session_id VARCHAR(255) NOT NULL, -- Unique identifier for each progression session
    session_type VARCHAR(50) DEFAULT 'refinement', -- refinement, guidance, validation, etc.

    -- Specialist selection tracking
    specialist_selected VARCHAR(255), -- The specialist type that was selected
    specialist_reason TEXT, -- Why this specialist was chosen
    previous_specialists JSONB DEFAULT '[]'::jsonb, -- History of specialists used in this session

    -- Refinement outcome tracking
    refinement_stage VARCHAR(100), -- problem_understanding, solution_design, validation, etc.
    refinement_outcome VARCHAR(50), -- completed, in_progress, abandoned, escalated
    outcome_data JSONB DEFAULT '{}'::jsonb, -- Structured data about the outcome

    -- Progression context
    current_persona_stack JSONB, -- The persona stack at this progression step
    progression_context JSONB DEFAULT '{}'::jsonb, -- Additional context data

    -- Metrics and scoring
    progression_score DECIMAL(5,2), -- 0-100 score of progression quality
    time_spent_minutes INTEGER, -- Time spent in this progression step
    user_satisfaction INTEGER CHECK (user_satisfaction BETWEEN 1 AND 5), -- Optional user rating

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to update updated_at on record changes
DROP TRIGGER IF EXISTS set_timestamp_users ON users;
CREATE TRIGGER set_timestamp_users
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_workspaces ON workspaces;
CREATE TRIGGER set_timestamp_workspaces
    BEFORE UPDATE ON workspaces
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_projects ON projects;
CREATE TRIGGER set_timestamp_projects
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_github_repositories ON github_repositories;
CREATE TRIGGER set_timestamp_github_repositories
    BEFORE UPDATE ON github_repositories
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- Requirements table
CREATE TABLE IF NOT EXISTS requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Requirement classification
    priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5), -- 1=highest, 5=lowest
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, completed, archived
    type VARCHAR(50) DEFAULT 'feature', -- feature, bug, enhancement, epic

    -- GitHub integration
    github_issue_number INTEGER,
    github_issue_url VARCHAR(500),

    -- Soft delete flag
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Refinement sessions table
CREATE TABLE IF NOT EXISTS refinement_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- user who initiated the session

    -- Session metadata
    title VARCHAR(500),
    description TEXT,
    status VARCHAR(50) DEFAULT 'active', -- active, completed, paused, cancelled

    -- Session tracking
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Requirement messages table (conversation history within refinement sessions)
CREATE TABLE IF NOT EXISTS requirement_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,
    session_id UUID REFERENCES refinement_sessions(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL, -- can be null for system messages

    -- Message content
    message_type VARCHAR(50) DEFAULT 'user_message', -- user_message, ai_response, system_note, clarification_request
    content TEXT NOT NULL,

    -- Message metadata
    role VARCHAR(50), -- user, assistant, system
    metadata JSONB DEFAULT '{}'::jsonb, -- additional structured data

    -- Ordering and threading
    sequence_number INTEGER NOT NULL, -- for chronological ordering within a session
    parent_message_id UUID REFERENCES requirement_messages(id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_requirements_project_id ON requirements(project_id);
CREATE INDEX IF NOT EXISTS idx_requirements_author_id ON requirements(author_id);
CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status);
CREATE INDEX IF NOT EXISTS idx_requirements_is_active ON requirements(is_active);
CREATE INDEX IF NOT EXISTS idx_requirements_github_issue_number ON requirements(github_issue_number);

CREATE INDEX IF NOT EXISTS idx_refinement_sessions_requirement_id ON refinement_sessions(requirement_id);
CREATE INDEX IF NOT EXISTS idx_refinement_sessions_user_id ON refinement_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_refinement_sessions_status ON refinement_sessions(status);
CREATE INDEX IF NOT EXISTS idx_refinement_sessions_started_at ON refinement_sessions(started_at);

CREATE INDEX IF NOT EXISTS idx_requirement_messages_requirement_id ON requirement_messages(requirement_id);
CREATE INDEX IF NOT EXISTS idx_requirement_messages_session_id ON requirement_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_requirement_messages_author_id ON requirement_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_requirement_messages_sequence_number ON requirement_messages(session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_requirement_messages_parent_message_id ON requirement_messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_requirement_messages_created_at ON requirement_messages(created_at);

-- Add triggers for updated_at timestamps
>>>>>>> dust-polecat/polecat/guzzle/gt-f9e
DROP TRIGGER IF EXISTS set_timestamp_requirements ON requirements;
CREATE TRIGGER set_timestamp_requirements
    BEFORE UPDATE ON requirements
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_persona_progression_history ON persona_progression_history;
CREATE TRIGGER set_timestamp_persona_progression_history
    BEFORE UPDATE ON persona_progression_history
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- Indexes for persona_progression_history table
CREATE INDEX IF NOT EXISTS idx_persona_progression_project_id ON persona_progression_history(project_id);
CREATE INDEX IF NOT EXISTS idx_persona_progression_user_id ON persona_progression_history(user_id);
CREATE INDEX IF NOT EXISTS idx_persona_progression_session_id ON persona_progression_history(session_id);
CREATE INDEX IF NOT EXISTS idx_persona_progression_session_type ON persona_progression_history(session_type);
CREATE INDEX IF NOT EXISTS idx_persona_progression_specialist ON persona_progression_history(specialist_selected);
CREATE INDEX IF NOT EXISTS idx_persona_progression_stage ON persona_progression_history(refinement_stage);
CREATE INDEX IF NOT EXISTS idx_persona_progression_outcome ON persona_progression_history(refinement_outcome);
CREATE INDEX IF NOT EXISTS idx_persona_progression_created_at ON persona_progression_history(created_at);

DROP TRIGGER IF EXISTS set_timestamp_refinement_sessions ON refinement_sessions;
CREATE TRIGGER set_timestamp_refinement_sessions
    BEFORE UPDATE ON refinement_sessions
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_requirement_messages ON requirement_messages;
CREATE TRIGGER set_timestamp_requirement_messages
    BEFORE UPDATE ON requirement_messages
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();
