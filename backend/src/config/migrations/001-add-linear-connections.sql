-- Migration: Add Linear connection support to projects
-- This implements B-501: Linear connection domain and validation

-- Add Linear connection fields to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS linear_config JSONB DEFAULT NULL;

-- Create Linear connections table for detailed tracking
CREATE TABLE IF NOT EXISTS linear_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

    -- Linear API configuration
    api_token_hash VARCHAR(255) NOT NULL, -- Hashed API token for security
    workspace_id VARCHAR(255) NOT NULL,
    workspace_name VARCHAR(255),
    team_id VARCHAR(255) NOT NULL,
    team_name VARCHAR(255),

    -- Optional board/project mapping
    board_id VARCHAR(255),
    board_name VARCHAR(255),
    project_id_linear VARCHAR(255), -- Linear project ID (different from our project_id)
    project_name_linear VARCHAR(255),

    -- Validation and status
    is_validated BOOLEAN DEFAULT FALSE,
    validation_error TEXT,
    last_validated_at TIMESTAMP WITH TIME ZONE,

    -- Connection metadata
    linear_organization_id VARCHAR(255),
    linear_organization_name VARCHAR(255),
    permissions JSONB DEFAULT '[]'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Only one Linear connection per project for MVP
    UNIQUE(project_id)
);

-- Create indexes for Linear connections
CREATE INDEX IF NOT EXISTS idx_linear_connections_project_id ON linear_connections(project_id);
CREATE INDEX IF NOT EXISTS idx_linear_connections_workspace_team ON linear_connections(workspace_id, team_id);
CREATE INDEX IF NOT EXISTS idx_linear_connections_validated ON linear_connections(is_validated);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS set_timestamp_linear_connections ON linear_connections;
CREATE TRIGGER set_timestamp_linear_connections
    BEFORE UPDATE ON linear_connections
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();