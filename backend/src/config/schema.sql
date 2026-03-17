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

-- Requirements table (B-101)
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

-- Refinement sessions table (B-105/B-202)
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

-- Requirement messages table (conversation history within refinement sessions) (B-105)
CREATE TABLE IF NOT EXISTS requirement_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,
    session_id UUID REFERENCES refinement_sessions(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL, -- can be null for system/AI messages

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

-- Refinement summaries table (B-204)
CREATE TABLE IF NOT EXISTS refinement_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,
    session_id UUID REFERENCES refinement_sessions(id) ON DELETE CASCADE,

    -- Summary content
    title VARCHAR(500),
    summary TEXT NOT NULL,
    key_points TEXT[],
    clarifications_made TEXT[],
    outstanding_questions TEXT[],

    -- Progress tracking
    message_count INTEGER NOT NULL, -- number of messages when this summary was generated
    confidence_score DECIMAL(3,2), -- 0.0 to 1.0, how confident the AI is in the summary

    -- Summary metadata
    summary_type VARCHAR(50) DEFAULT 'conversation_progress', -- conversation_progress, final_summary, milestone
    generated_by VARCHAR(50) DEFAULT 'ai', -- ai, user, system
    version INTEGER DEFAULT 1, -- allows for versioning of summaries

    -- AI generation metadata
    ai_model VARCHAR(100),
    ai_tokens_used INTEGER,
    generation_metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for refinement summaries
CREATE INDEX IF NOT EXISTS idx_refinement_summaries_requirement_id ON refinement_summaries(requirement_id);
CREATE INDEX IF NOT EXISTS idx_refinement_summaries_session_id ON refinement_summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_refinement_summaries_type ON refinement_summaries(summary_type);
CREATE INDEX IF NOT EXISTS idx_refinement_summaries_message_count ON refinement_summaries(session_id, message_count);
CREATE INDEX IF NOT EXISTS idx_refinement_summaries_created_at ON refinement_summaries(created_at);

-- Add trigger for updated_at timestamp
DROP TRIGGER IF EXISTS set_timestamp_refinement_summaries ON refinement_summaries;
CREATE TRIGGER set_timestamp_refinement_summaries
    BEFORE UPDATE ON refinement_summaries
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- Requirement readiness state table (B-205)
CREATE TABLE IF NOT EXISTS requirement_readiness (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,

    -- Readiness dimensions (0.0 to 1.0 scale)
    clarity_score DECIMAL(3,2) NOT NULL DEFAULT 0.0, -- How well-defined and unambiguous
    completeness_score DECIMAL(3,2) NOT NULL DEFAULT 0.0, -- Whether all necessary details are specified
    testability_score DECIMAL(3,2) NOT NULL DEFAULT 0.0, -- Whether it has clear acceptance criteria
    feasibility_score DECIMAL(3,2) NOT NULL DEFAULT 0.0, -- Whether it's technically achievable
    specificity_score DECIMAL(3,2) NOT NULL DEFAULT 0.0, -- Whether it's specific enough to implement

    -- Overall readiness score (derived from dimensions)
    overall_score DECIMAL(3,2) NOT NULL DEFAULT 0.0, -- Weighted average of dimension scores
    readiness_level VARCHAR(20) DEFAULT 'not_ready', -- not_ready, partially_ready, ready, fully_ready

    -- Analysis metadata
    analysis_source VARCHAR(50) DEFAULT 'ai_analysis', -- ai_analysis, manual_review, hybrid
    confidence_score DECIMAL(3,2), -- How confident the AI is in this assessment
    missing_areas TEXT[], -- Array of areas that need improvement
    recommendations TEXT[], -- Array of recommendations for improvement

    -- Computation metadata
    computed_from_summary_id UUID REFERENCES refinement_summaries(id) ON DELETE SET NULL,
    computation_version INTEGER DEFAULT 1, -- Version of the readiness computation algorithm
    ai_model VARCHAR(100), -- AI model used for analysis
    analysis_metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_clarity_score CHECK (clarity_score >= 0.0 AND clarity_score <= 1.0),
    CONSTRAINT valid_completeness_score CHECK (completeness_score >= 0.0 AND completeness_score <= 1.0),
    CONSTRAINT valid_testability_score CHECK (testability_score >= 0.0 AND testability_score <= 1.0),
    CONSTRAINT valid_feasibility_score CHECK (feasibility_score >= 0.0 AND feasibility_score <= 1.0),
    CONSTRAINT valid_specificity_score CHECK (specificity_score >= 0.0 AND specificity_score <= 1.0),
    CONSTRAINT valid_overall_score CHECK (overall_score >= 0.0 AND overall_score <= 1.0),
    CONSTRAINT valid_confidence_score CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0))
);

-- Indexes for requirement readiness
CREATE INDEX IF NOT EXISTS idx_requirement_readiness_requirement_id ON requirement_readiness(requirement_id);
CREATE INDEX IF NOT EXISTS idx_requirement_readiness_overall_score ON requirement_readiness(overall_score);
CREATE INDEX IF NOT EXISTS idx_requirement_readiness_level ON requirement_readiness(readiness_level);
CREATE INDEX IF NOT EXISTS idx_requirement_readiness_summary_id ON requirement_readiness(computed_from_summary_id);
CREATE INDEX IF NOT EXISTS idx_requirement_readiness_created_at ON requirement_readiness(created_at);

-- Only allow one readiness record per requirement (latest analysis)
CREATE UNIQUE INDEX IF NOT EXISTS idx_requirement_readiness_unique_requirement
    ON requirement_readiness(requirement_id);

-- Add trigger for updated_at timestamp
DROP TRIGGER IF EXISTS set_timestamp_requirement_readiness ON requirement_readiness;
CREATE TRIGGER set_timestamp_requirement_readiness
    BEFORE UPDATE ON requirement_readiness
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- Readiness gate overrides table (B-305)
CREATE TABLE IF NOT EXISTS readiness_gate_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,

    -- Override details
    override_type VARCHAR(50) NOT NULL, -- manual_approval, emergency_bypass, stakeholder_decision
    override_reason TEXT NOT NULL, -- Why the override was granted
    overridden_by UUID REFERENCES users(id) ON DELETE SET NULL, -- User who granted override

    -- Gate state at time of override
    gate_check_result JSONB, -- Full gate check result that was overridden
    readiness_score_at_override DECIMAL(3,2), -- Overall score when overridden
    blocking_dimensions TEXT[], -- Which dimensions were blocking

    -- Override metadata
    is_active BOOLEAN DEFAULT true, -- Can be revoked
    valid_until TIMESTAMP WITH TIME ZONE, -- Optional expiration
    conditions TEXT, -- Any conditions attached to the override

    -- Approval workflow (for future use)
    approval_status VARCHAR(20) DEFAULT 'granted', -- pending, granted, revoked
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Only one active override per requirement
    UNIQUE(requirement_id, is_active) WHERE is_active = true
);

-- Indexes for readiness gate overrides
CREATE INDEX IF NOT EXISTS idx_readiness_gate_overrides_requirement_id ON readiness_gate_overrides(requirement_id);
CREATE INDEX IF NOT EXISTS idx_readiness_gate_overrides_overridden_by ON readiness_gate_overrides(overridden_by);
CREATE INDEX IF NOT EXISTS idx_readiness_gate_overrides_is_active ON readiness_gate_overrides(is_active);
CREATE INDEX IF NOT EXISTS idx_readiness_gate_overrides_created_at ON readiness_gate_overrides(created_at);

-- Add trigger for updated_at timestamp
DROP TRIGGER IF EXISTS set_timestamp_readiness_gate_overrides ON readiness_gate_overrides;
CREATE TRIGGER set_timestamp_readiness_gate_overrides
    BEFORE UPDATE ON readiness_gate_overrides
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();