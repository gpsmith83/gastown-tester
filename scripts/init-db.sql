-- Initialize Gastown Tester database
-- This script runs automatically when the PostgreSQL container starts

-- Create basic tables for the application
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create a jobs table for the worker queue
CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    payload JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create an index on job status for efficient querying
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- Insert some sample data
INSERT INTO users (email, name) VALUES
    ('admin@gastown.dev', 'Admin User'),
    ('developer@gastown.dev', 'Developer User')
ON CONFLICT (email) DO NOTHING;

-- Insert a sample job
INSERT INTO jobs (type, payload, status) VALUES
    ('welcome_email', '{"user_id": 1, "template": "welcome"}', 'pending')
ON CONFLICT DO NOTHING;