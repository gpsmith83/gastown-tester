-- Migration: Add performance monitoring and metrics collection system
-- This implements B-701: Performance monitoring and metrics collection

-- Create monitoring_metrics table for comprehensive performance data
CREATE TABLE IF NOT EXISTS monitoring_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Request identification and correlation
    correlation_id VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- HTTP request details
    method VARCHAR(10) NOT NULL,
    path VARCHAR(500) NOT NULL,
    status_code INTEGER NOT NULL,

    -- Performance metrics
    response_time_ms INTEGER NOT NULL, -- Response time in milliseconds
    request_size_bytes INTEGER DEFAULT 0, -- Request body size
    response_size_bytes INTEGER DEFAULT 0, -- Response body size

    -- Resource usage metrics
    memory_usage_mb DECIMAL(10, 2), -- Memory usage in MB at request time
    cpu_usage_percent DECIMAL(5, 2), -- CPU usage percentage

    -- Error tracking
    is_error BOOLEAN DEFAULT FALSE,
    error_type VARCHAR(100), -- Type of error if any
    error_message TEXT, -- Error message if any

    -- Client and request metadata
    user_agent VARCHAR(1000),
    ip_address INET,

    -- Timestamps
    request_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_correlation_id ON monitoring_metrics(correlation_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_timestamp ON monitoring_metrics(request_timestamp);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_path ON monitoring_metrics(path);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_status_code ON monitoring_metrics(status_code);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_response_time ON monitoring_metrics(response_time_ms);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_is_error ON monitoring_metrics(is_error);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_user_id ON monitoring_metrics(user_id);

-- Index for time-series analytics
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_time_path ON monitoring_metrics(request_timestamp, path);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_time_status ON monitoring_metrics(request_timestamp, status_code);