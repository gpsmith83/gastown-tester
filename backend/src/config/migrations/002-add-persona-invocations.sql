-- Migration: Add persona invocation model and audit trail
-- This implements B-301: Implement persona invocation model and audit trail

-- Refinement sessions table (if not already exists from B-105)
CREATE TABLE IF NOT EXISTS refinement_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active', -- active, completed, archived
    session_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Refinement messages table (if not already exists from B-105)
CREATE TABLE IF NOT EXISTS refinement_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES refinement_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message_type VARCHAR(50) NOT NULL, -- user_message, ai_response, system_message
    content TEXT NOT NULL,
    message_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Persona invocations table
CREATE TABLE IF NOT EXISTS persona_invocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,
    session_id UUID REFERENCES refinement_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Persona information
    persona_name VARCHAR(255) NOT NULL,
    persona_type VARCHAR(100), -- e.g., 'architect', 'security', 'ui_designer'
    persona_description TEXT,

    -- Invocation context
    invocation_reason TEXT NOT NULL, -- Why this persona was invoked
    trigger_context JSONB, -- What triggered the persona invocation

    -- Contributed dimensions
    contributed_dimensions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of dimension objects
    dimension_summary TEXT, -- Human-readable summary of contributions

    -- Invocation metadata
    invocation_status VARCHAR(50) DEFAULT 'completed', -- pending, completed, failed
    invocation_metadata JSONB DEFAULT '{}'::jsonb,

    -- Timing
    invoked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Persona dimension contributions table (for detailed tracking)
CREATE TABLE IF NOT EXISTS persona_dimension_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invocation_id UUID REFERENCES persona_invocations(id) ON DELETE CASCADE,

    -- Dimension details
    dimension_category VARCHAR(100) NOT NULL, -- e.g., 'security', 'performance', 'usability'
    dimension_name VARCHAR(255) NOT NULL,
    dimension_value TEXT,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00

    -- Contribution metadata
    contribution_type VARCHAR(50), -- 'addition', 'modification', 'validation', 'concern'
    impact_level VARCHAR(50), -- 'low', 'medium', 'high', 'critical'
    rationale TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_refinement_sessions_requirement_id ON refinement_sessions(requirement_id);
CREATE INDEX IF NOT EXISTS idx_refinement_sessions_user_id ON refinement_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_refinement_sessions_status ON refinement_sessions(status);

CREATE INDEX IF NOT EXISTS idx_refinement_messages_session_id ON refinement_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_refinement_messages_user_id ON refinement_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_refinement_messages_type ON refinement_messages(message_type);

CREATE INDEX IF NOT EXISTS idx_persona_invocations_requirement_id ON persona_invocations(requirement_id);
CREATE INDEX IF NOT EXISTS idx_persona_invocations_session_id ON persona_invocations(session_id);
CREATE INDEX IF NOT EXISTS idx_persona_invocations_user_id ON persona_invocations(user_id);
CREATE INDEX IF NOT EXISTS idx_persona_invocations_persona_type ON persona_invocations(persona_type);
CREATE INDEX IF NOT EXISTS idx_persona_invocations_status ON persona_invocations(invocation_status);

CREATE INDEX IF NOT EXISTS idx_persona_dimension_contributions_invocation_id ON persona_dimension_contributions(invocation_id);
CREATE INDEX IF NOT EXISTS idx_persona_dimension_contributions_category ON persona_dimension_contributions(dimension_category);

-- Add triggers to update updated_at on record changes
DROP TRIGGER IF EXISTS set_timestamp_refinement_sessions ON refinement_sessions;
CREATE TRIGGER set_timestamp_refinement_sessions
    BEFORE UPDATE ON refinement_sessions
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_persona_invocations ON persona_invocations;
CREATE TRIGGER set_timestamp_persona_invocations
    BEFORE UPDATE ON persona_invocations
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();