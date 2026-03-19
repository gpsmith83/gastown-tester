<<<<<<< HEAD
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
=======
-- Migration: Add export batch system (B-503 foundation)
-- This implements export batch processing for GitHub and other integrations

-- Export batches table
CREATE TABLE IF NOT EXISTS export_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

    -- Batch metadata
    type VARCHAR(50) NOT NULL, -- github_issues, linear_issues, etc.
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, retrying

    -- Export configuration
    target_service VARCHAR(50) NOT NULL, -- github, linear
    target_config JSONB DEFAULT '{}'::jsonb, -- service-specific config (repo, team, etc.)

    -- Progress tracking
    total_items INT DEFAULT 0,
    processed_items INT DEFAULT 0,
    failed_items INT DEFAULT 0,

    -- Retry configuration
    max_retries INT DEFAULT 3,
    retry_count INT DEFAULT 0,
    retry_delay_seconds INT DEFAULT 30,

    -- Result tracking
    results JSONB DEFAULT '{}'::jsonb, -- stores export results and errors
    error_message TEXT,

    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,
>>>>>>> check-fury-w8a

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

<<<<<<< HEAD
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
=======
-- Export batch items table - individual items within a batch
CREATE TABLE IF NOT EXISTS export_batch_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES export_batches(id) ON DELETE CASCADE,

    -- Source item reference (e.g., requirement)
    source_type VARCHAR(50) NOT NULL, -- requirement, etc.
    source_id UUID NOT NULL,

    -- Export status
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, skipped

    -- Retry tracking
    retry_count INT DEFAULT 0,

    -- Results
    external_id VARCHAR(255), -- e.g., GitHub issue number
    external_url VARCHAR(500), -- e.g., GitHub issue URL
    export_data JSONB DEFAULT '{}'::jsonb, -- exported data
    error_message TEXT,

    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
>>>>>>> check-fury-w8a
    completed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

<<<<<<< HEAD
    -- Ensure each requirement appears only once per batch
    UNIQUE(batch_id, requirement_id)
=======
    -- Ensure uniqueness per batch
    UNIQUE(batch_id, source_type, source_id)
>>>>>>> check-fury-w8a
);

-- Create indexes for export batches
CREATE INDEX IF NOT EXISTS idx_export_batches_project_id ON export_batches(project_id);
CREATE INDEX IF NOT EXISTS idx_export_batches_status ON export_batches(status);
<<<<<<< HEAD
CREATE INDEX IF NOT EXISTS idx_export_batches_target_type ON export_batches(target_type);
CREATE INDEX IF NOT EXISTS idx_export_batches_created_by ON export_batches(created_by);

-- Create indexes for export batch items
CREATE INDEX IF NOT EXISTS idx_export_batch_items_batch_id ON export_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_export_batch_items_requirement_id ON export_batch_items(requirement_id);
CREATE INDEX IF NOT EXISTS idx_export_batch_items_status ON export_batch_items(status);
CREATE INDEX IF NOT EXISTS idx_export_batch_items_external_id ON export_batch_items(external_id);
=======
CREATE INDEX IF NOT EXISTS idx_export_batches_type ON export_batches(type);
CREATE INDEX IF NOT EXISTS idx_export_batches_target_service ON export_batches(target_service);
CREATE INDEX IF NOT EXISTS idx_export_batches_next_retry_at ON export_batches(next_retry_at);

CREATE INDEX IF NOT EXISTS idx_export_batch_items_batch_id ON export_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_export_batch_items_source ON export_batch_items(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_export_batch_items_status ON export_batch_items(status);
>>>>>>> check-fury-w8a

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