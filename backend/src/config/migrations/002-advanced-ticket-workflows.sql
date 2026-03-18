-- Migration: Advanced ticket workflows and lifecycle (B-404, B-405, B-406, B-407)
-- Adds assignment, advanced status workflow, time tracking, and lifecycle management

-- B-405: Add assignment fields to requirements table
ALTER TABLE requirements
ADD COLUMN assignee_id UUID REFERENCES users(id),
ADD COLUMN assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN assigned_by UUID REFERENCES users(id);

-- B-404: Expand status workflow beyond basic draft/active/completed/archived
-- Update status column to support more workflow states
ALTER TABLE requirements
DROP CONSTRAINT IF EXISTS requirements_status_check;

ALTER TABLE requirements
ADD CONSTRAINT requirements_status_check
CHECK (status IN (
  'draft', 'open', 'in_progress', 'in_review',
  'testing', 'blocked', 'completed', 'archived', 'cancelled'
));

-- B-406: Add more sophisticated priority management
ALTER TABLE requirements
ADD COLUMN priority_label VARCHAR(50), -- 'critical', 'high', 'medium', 'low', 'backlog'
ADD COLUMN due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN urgency_score INTEGER DEFAULT 0; -- 0-100 calculated urgency

-- B-407: Add lifecycle management fields
ALTER TABLE requirements
ADD COLUMN estimated_hours DECIMAL(8,2),
ADD COLUMN actual_hours DECIMAL(8,2) DEFAULT 0,
ADD COLUMN story_points INTEGER,
ADD COLUMN started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN resolution VARCHAR(100), -- 'done', 'wont_fix', 'duplicate', 'invalid'
ADD COLUMN resolution_notes TEXT,
ADD COLUMN labels JSONB DEFAULT '[]'::jsonb,
ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

-- Create requirement_comments table for discussion and updates
CREATE TABLE IF NOT EXISTS requirement_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    comment_type VARCHAR(50) DEFAULT 'comment', -- 'comment', 'status_change', 'assignment_change', 'priority_change'
    metadata JSONB DEFAULT '{}'::jsonb, -- Store change details for system comments
    is_internal BOOLEAN DEFAULT false, -- Internal team comments vs public
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create requirement_history table for tracking all changes
CREATE TABLE IF NOT EXISTS requirement_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES users(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL, -- e.g., 'status', 'assignee_id', 'priority'
    old_value TEXT,
    new_value TEXT,
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create requirement_watchers table for notifications
CREATE TABLE IF NOT EXISTS requirement_watchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    watch_type VARCHAR(50) DEFAULT 'all', -- 'all', 'mentions', 'status_changes'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(requirement_id, user_id)
);

-- Create requirement_dependencies table for blocking relationships
CREATE TABLE IF NOT EXISTS requirement_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE, -- the requirement that is blocked
    dependency_id UUID REFERENCES requirements(id) ON DELETE CASCADE,  -- the requirement that blocks it
    dependency_type VARCHAR(50) DEFAULT 'blocks', -- 'blocks', 'relates_to', 'duplicate_of'
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(requirement_id, dependency_id, dependency_type)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_requirements_assignee_id ON requirements(assignee_id);
CREATE INDEX IF NOT EXISTS idx_requirements_assigned_by ON requirements(assigned_by);
CREATE INDEX IF NOT EXISTS idx_requirements_due_date ON requirements(due_date);
CREATE INDEX IF NOT EXISTS idx_requirements_priority_label ON requirements(priority_label);
CREATE INDEX IF NOT EXISTS idx_requirements_urgency_score ON requirements(urgency_score);
CREATE INDEX IF NOT EXISTS idx_requirements_started_at ON requirements(started_at);
CREATE INDEX IF NOT EXISTS idx_requirements_completed_at ON requirements(completed_at);
CREATE INDEX IF NOT EXISTS idx_requirements_labels ON requirements USING gin(labels);

CREATE INDEX IF NOT EXISTS idx_requirement_comments_requirement_id ON requirement_comments(requirement_id);
CREATE INDEX IF NOT EXISTS idx_requirement_comments_author_id ON requirement_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_requirement_comments_created_at ON requirement_comments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requirement_history_requirement_id ON requirement_history(requirement_id);
CREATE INDEX IF NOT EXISTS idx_requirement_history_changed_by ON requirement_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_requirement_history_field_name ON requirement_history(field_name);
CREATE INDEX IF NOT EXISTS idx_requirement_history_created_at ON requirement_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requirement_watchers_requirement_id ON requirement_watchers(requirement_id);
CREATE INDEX IF NOT EXISTS idx_requirement_watchers_user_id ON requirement_watchers(user_id);

CREATE INDEX IF NOT EXISTS idx_requirement_dependencies_requirement_id ON requirement_dependencies(requirement_id);
CREATE INDEX IF NOT EXISTS idx_requirement_dependencies_dependency_id ON requirement_dependencies(dependency_id);

-- Add triggers for updated_at on new tables
CREATE TRIGGER set_timestamp_requirement_comments
    BEFORE UPDATE ON requirement_comments
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- Auto-populate priority_label based on priority number
UPDATE requirements
SET priority_label = CASE
    WHEN priority = 1 THEN 'critical'
    WHEN priority = 2 THEN 'high'
    WHEN priority = 3 THEN 'medium'
    WHEN priority = 4 THEN 'low'
    WHEN priority = 5 THEN 'backlog'
    ELSE 'medium'
END
WHERE priority_label IS NULL;

-- Create function to auto-update timestamps for lifecycle events
CREATE OR REPLACE FUNCTION update_requirement_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    -- Set started_at when status changes from draft/open to in_progress
    IF OLD.status IN ('draft', 'open') AND NEW.status = 'in_progress' AND NEW.started_at IS NULL THEN
        NEW.started_at = NOW();
    END IF;

    -- Set completed_at when status changes to completed
    IF OLD.status != 'completed' AND NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
        NEW.completed_at = NOW();
    END IF;

    -- Clear completed_at if status changes away from completed
    IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
        NEW.completed_at = NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-update requirement timestamps
DROP TRIGGER IF EXISTS trigger_requirement_lifecycle_timestamps ON requirements;
CREATE TRIGGER trigger_requirement_lifecycle_timestamps
    BEFORE UPDATE ON requirements
    FOR EACH ROW
    EXECUTE PROCEDURE update_requirement_timestamps();