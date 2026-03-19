-- Migration: Add export tracking and status system (B-507)
-- This implements export confirmation, status tracking, export history, and notifications

-- Export jobs table for tracking export operations
CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Export metadata
    name VARCHAR(255) NOT NULL,
    description TEXT,
    export_type VARCHAR(50) NOT NULL, -- requirements, projects, workspace
    format VARCHAR(20) NOT NULL DEFAULT 'csv', -- csv, json, xlsx

    -- Relationships
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE, -- optional, null for workspace exports

    -- Export configuration
    filters JSONB DEFAULT '{}'::jsonb, -- filtering criteria applied
    columns JSONB DEFAULT '[]'::jsonb, -- specific columns/fields to include
    options JSONB DEFAULT '{}'::jsonb, -- format-specific options

    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
    progress_percentage INT DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),

    -- Results and file handling
    file_path VARCHAR(500), -- where the exported file is stored
    file_size_bytes BIGINT,
    total_records INT,
    exported_records INT,

    -- Error handling
    error_message TEXT,
    error_details JSONB,

    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE, -- when the export file will be deleted

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Export confirmations table for user acknowledgments
CREATE TABLE IF NOT EXISTS export_confirmations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    export_job_id UUID REFERENCES export_jobs(id) ON DELETE CASCADE NOT NULL,

    -- Confirmation details
    confirmed_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    confirmation_message TEXT,

    -- User feedback
    satisfaction_rating INT CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    feedback_comment TEXT,

    -- Download tracking
    download_count INT DEFAULT 0,
    last_downloaded_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- One confirmation per user per export
    UNIQUE(export_job_id, confirmed_by)
);

-- Export notifications table for completion alerts
CREATE TABLE IF NOT EXISTS export_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    export_job_id UUID REFERENCES export_jobs(id) ON DELETE CASCADE NOT NULL,

    -- Notification details
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- completed, failed, reminder
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    -- Delivery tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, sent, failed
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,

    -- Channel configuration
    channels JSONB DEFAULT '["web"]'::jsonb, -- web, email (for future expansion)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Export activity log for detailed tracking
CREATE TABLE IF NOT EXISTS export_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    export_job_id UUID REFERENCES export_jobs(id) ON DELETE CASCADE NOT NULL,

    -- Activity details
    activity_type VARCHAR(50) NOT NULL, -- created, started, progress_updated, completed, failed, downloaded
    description TEXT,

    -- User context
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,

    -- Activity data
    details JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_export_jobs_user_id ON export_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_workspace_id ON export_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_project_id ON export_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created_at ON export_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_export_jobs_expires_at ON export_jobs(expires_at);

CREATE INDEX IF NOT EXISTS idx_export_confirmations_export_job_id ON export_confirmations(export_job_id);
CREATE INDEX IF NOT EXISTS idx_export_confirmations_confirmed_by ON export_confirmations(confirmed_by);

CREATE INDEX IF NOT EXISTS idx_export_notifications_export_job_id ON export_notifications(export_job_id);
CREATE INDEX IF NOT EXISTS idx_export_notifications_recipient_id ON export_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_export_notifications_status ON export_notifications(status);

CREATE INDEX IF NOT EXISTS idx_export_activity_log_export_job_id ON export_activity_log(export_job_id);
CREATE INDEX IF NOT EXISTS idx_export_activity_log_activity_type ON export_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_export_activity_log_created_at ON export_activity_log(created_at);

-- Add triggers for updated_at columns
DROP TRIGGER IF EXISTS set_timestamp_export_jobs ON export_jobs;
CREATE TRIGGER set_timestamp_export_jobs
    BEFORE UPDATE ON export_jobs
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_export_confirmations ON export_confirmations;
CREATE TRIGGER set_timestamp_export_confirmations
    BEFORE UPDATE ON export_confirmations
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_export_notifications ON export_notifications;
CREATE TRIGGER set_timestamp_export_notifications
    BEFORE UPDATE ON export_notifications
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();
