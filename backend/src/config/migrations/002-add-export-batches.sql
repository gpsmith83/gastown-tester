-- Migration: Add export batch support for Linear and other integrations
-- This implements B-503: Export batch processing and B-504: Linear export implementation

-- Export batches table for tracking batch export operations
CREATE TABLE IF NOT EXISTS export_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Export target configuration
    target_type VARCHAR(50) NOT NULL, -- 'linear', etc.
    target_config JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Batch status and progress
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed, partially_completed
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,

    -- Metadata
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,

    -- Settings
    retry_failed BOOLEAN DEFAULT TRUE,
    max_retries INTEGER DEFAULT 3,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Export batch items table for tracking individual requirement exports
CREATE TABLE IF NOT EXISTS export_batch_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES export_batches(id) ON DELETE CASCADE,
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,

    -- Item status and result
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed
    external_id VARCHAR(255), -- ID in the target system (e.g., Linear issue ID)
    external_url VARCHAR(500), -- URL in the target system (e.g., Linear issue URL)

    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    last_attempted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure each requirement appears only once per batch
    UNIQUE(batch_id, requirement_id)
);

-- Create indexes for export batches
CREATE INDEX IF NOT EXISTS idx_export_batches_project_id ON export_batches(project_id);
CREATE INDEX IF NOT EXISTS idx_export_batches_status ON export_batches(status);
CREATE INDEX IF NOT EXISTS idx_export_batches_target_type ON export_batches(target_type);
CREATE INDEX IF NOT EXISTS idx_export_batches_created_by ON export_batches(created_by);

-- Create indexes for export batch items
CREATE INDEX IF NOT EXISTS idx_export_batch_items_batch_id ON export_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_export_batch_items_requirement_id ON export_batch_items(requirement_id);
CREATE INDEX IF NOT EXISTS idx_export_batch_items_status ON export_batch_items(status);
CREATE INDEX IF NOT EXISTS idx_export_batch_items_external_id ON export_batch_items(external_id);

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS set_timestamp_export_batches ON export_batches;
CREATE TRIGGER set_timestamp_export_batches
    BEFORE UPDATE ON export_batches
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_export_batch_items ON export_batch_items;
CREATE TRIGGER set_timestamp_export_batch_items
    BEFORE UPDATE ON export_batch_items
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();