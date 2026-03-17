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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);

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
DROP TRIGGER IF EXISTS set_timestamp_requirements ON requirements;
CREATE TRIGGER set_timestamp_requirements
    BEFORE UPDATE ON requirements
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

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