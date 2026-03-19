-- Migration: Add provider payload audit retention and retrieval
-- This implements B-706: Implement full provider payload audit retention and retrieval

-- AI Provider audit table for full payload storage
CREATE TABLE IF NOT EXISTS ai_provider_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Reference linking
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Provider context
    provider_type VARCHAR(50) NOT NULL, -- 'openai', 'anthropic', 'local'
    provider_model VARCHAR(100),
    provider_endpoint VARCHAR(255),

    -- Request/Response metadata
    correlation_id VARCHAR(255), -- Links to request correlation logging
    job_id VARCHAR(255), -- Links to background job tracking
    session_context JSONB, -- Additional session context

    -- Full payload audit (encrypted storage)
    request_payload JSONB NOT NULL, -- Complete request payload
    response_payload JSONB, -- Complete response payload
    response_status INTEGER, -- HTTP status code

    -- Usage metrics
    request_tokens INTEGER,
    response_tokens INTEGER,
    total_tokens INTEGER,
    latency_ms INTEGER,

    -- Audit metadata
    audit_level VARCHAR(20) DEFAULT 'full', -- 'full', 'metadata-only', 'disabled'
    retention_policy VARCHAR(50) DEFAULT 'standard', -- 'standard', 'extended', 'minimal'

    -- Success/failure tracking
    is_successful BOOLEAN DEFAULT FALSE,
    error_type VARCHAR(100),
    error_message TEXT,
    error_details JSONB,

    -- Timestamp tracking
    request_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    response_timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Provider audit summaries for efficient querying
CREATE TABLE IF NOT EXISTS ai_provider_audit_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Grouping dimensions
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider_type VARCHAR(50) NOT NULL,
    provider_model VARCHAR(100),

    -- Aggregated metrics (for date range)
    date_bucket DATE NOT NULL, -- Daily summary bucket
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,

    -- Token usage aggregates
    total_request_tokens BIGINT DEFAULT 0,
    total_response_tokens BIGINT DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,

    -- Performance metrics
    avg_latency_ms DECIMAL(10,2),
    min_latency_ms INTEGER,
    max_latency_ms INTEGER,

    -- Error tracking
    error_types JSONB DEFAULT '[]'::jsonb, -- Array of error types encountered

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint for summary buckets
    UNIQUE(requirement_id, user_id, provider_type, provider_model, date_bucket)
);

-- Create indexes for efficient audit retrieval
CREATE INDEX IF NOT EXISTS idx_ai_provider_audits_requirement_id ON ai_provider_audits(requirement_id);
CREATE INDEX IF NOT EXISTS idx_ai_provider_audits_user_id ON ai_provider_audits(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_provider_audits_provider_type ON ai_provider_audits(provider_type);
CREATE INDEX IF NOT EXISTS idx_ai_provider_audits_correlation_id ON ai_provider_audits(correlation_id);
CREATE INDEX IF NOT EXISTS idx_ai_provider_audits_job_id ON ai_provider_audits(job_id);
CREATE INDEX IF NOT EXISTS idx_ai_provider_audits_timestamps ON ai_provider_audits(request_timestamp, response_timestamp);
CREATE INDEX IF NOT EXISTS idx_ai_provider_audits_success ON ai_provider_audits(is_successful);

-- Indexes for audit summaries
CREATE INDEX IF NOT EXISTS idx_ai_provider_audit_summaries_requirement_id ON ai_provider_audit_summaries(requirement_id);
CREATE INDEX IF NOT EXISTS idx_ai_provider_audit_summaries_user_id ON ai_provider_audit_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_provider_audit_summaries_provider ON ai_provider_audit_summaries(provider_type, provider_model);
CREATE INDEX IF NOT EXISTS idx_ai_provider_audit_summaries_date ON ai_provider_audit_summaries(date_bucket);

-- Add triggers to update updated_at on record changes
DROP TRIGGER IF EXISTS set_timestamp_ai_provider_audits ON ai_provider_audits;
CREATE TRIGGER set_timestamp_ai_provider_audits
    BEFORE UPDATE ON ai_provider_audits
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_ai_provider_audit_summaries ON ai_provider_audit_summaries;
CREATE TRIGGER set_timestamp_ai_provider_audit_summaries
    BEFORE UPDATE ON ai_provider_audit_summaries
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- Function to automatically update summary tables
CREATE OR REPLACE FUNCTION update_ai_provider_audit_summary()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process completed requests (with response timestamp)
    IF NEW.response_timestamp IS NOT NULL AND NEW.is_successful IS NOT NULL THEN
        INSERT INTO ai_provider_audit_summaries (
            requirement_id, user_id, provider_type, provider_model, date_bucket,
            total_requests, successful_requests, failed_requests,
            total_request_tokens, total_response_tokens, total_tokens,
            avg_latency_ms, min_latency_ms, max_latency_ms,
            error_types
        )
        VALUES (
            NEW.requirement_id, NEW.user_id, NEW.provider_type, NEW.provider_model,
            DATE(NEW.request_timestamp),
            1,
            CASE WHEN NEW.is_successful THEN 1 ELSE 0 END,
            CASE WHEN NOT NEW.is_successful THEN 1 ELSE 0 END,
            COALESCE(NEW.request_tokens, 0),
            COALESCE(NEW.response_tokens, 0),
            COALESCE(NEW.total_tokens, 0),
            COALESCE(NEW.latency_ms, 0),
            COALESCE(NEW.latency_ms, 0),
            COALESCE(NEW.latency_ms, 0),
            CASE WHEN NEW.error_type IS NOT NULL THEN jsonb_build_array(NEW.error_type) ELSE '[]'::jsonb END
        )
        ON CONFLICT (requirement_id, user_id, provider_type, provider_model, date_bucket)
        DO UPDATE SET
            total_requests = ai_provider_audit_summaries.total_requests + 1,
            successful_requests = ai_provider_audit_summaries.successful_requests +
                CASE WHEN NEW.is_successful THEN 1 ELSE 0 END,
            failed_requests = ai_provider_audit_summaries.failed_requests +
                CASE WHEN NOT NEW.is_successful THEN 1 ELSE 0 END,
            total_request_tokens = ai_provider_audit_summaries.total_request_tokens + COALESCE(NEW.request_tokens, 0),
            total_response_tokens = ai_provider_audit_summaries.total_response_tokens + COALESCE(NEW.response_tokens, 0),
            total_tokens = ai_provider_audit_summaries.total_tokens + COALESCE(NEW.total_tokens, 0),
            avg_latency_ms = (
                (ai_provider_audit_summaries.avg_latency_ms * ai_provider_audit_summaries.total_requests + COALESCE(NEW.latency_ms, 0))
                / (ai_provider_audit_summaries.total_requests + 1)
            ),
            min_latency_ms = LEAST(ai_provider_audit_summaries.min_latency_ms, COALESCE(NEW.latency_ms, ai_provider_audit_summaries.min_latency_ms)),
            max_latency_ms = GREATEST(ai_provider_audit_summaries.max_latency_ms, COALESCE(NEW.latency_ms, ai_provider_audit_summaries.max_latency_ms)),
            error_types = CASE
                WHEN NEW.error_type IS NOT NULL AND NOT ai_provider_audit_summaries.error_types ? NEW.error_type
                THEN ai_provider_audit_summaries.error_types || jsonb_build_array(NEW.error_type)
                ELSE ai_provider_audit_summaries.error_types
            END,
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update summaries
DROP TRIGGER IF EXISTS update_ai_provider_audit_summary_trigger ON ai_provider_audits;
CREATE TRIGGER update_ai_provider_audit_summary_trigger
    AFTER INSERT OR UPDATE ON ai_provider_audits
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_provider_audit_summary();