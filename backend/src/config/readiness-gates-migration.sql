-- B-306: Readiness Gate Overrides Migration
-- Adds support for persona readiness gate overrides

-- Readiness gate overrides table
CREATE TABLE IF NOT EXISTS readiness_gate_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Override details
    dimension_id VARCHAR(255) NOT NULL, -- e.g., 'title', 'description', 'priority'
    dimension_name VARCHAR(255) NOT NULL,
    override_reason TEXT NOT NULL,
    original_score INT DEFAULT 0,
    override_score INT DEFAULT 100,

    -- Metadata
    override_type VARCHAR(50) DEFAULT 'manual', -- manual, automatic, persona_rule
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(requirement_id, dimension_id, user_id)
);

-- Persona progression gates table for managing gate rules
CREATE TABLE IF NOT EXISTS persona_progression_gates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

    -- Gate configuration
    gate_name VARCHAR(255) NOT NULL,
    gate_description TEXT,

    -- Gate criteria
    required_dimensions JSONB DEFAULT '[]'::jsonb, -- Array of required dimension IDs
    minimum_score INT DEFAULT 80, -- Minimum overall score to pass gate
    allow_overrides BOOLEAN DEFAULT true,

    -- Persona rules
    persona_type VARCHAR(255), -- Which persona this gate applies to
    gate_order INT DEFAULT 0, -- Order in progression sequence

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_readiness_gate_overrides_requirement_id
    ON readiness_gate_overrides(requirement_id);
CREATE INDEX IF NOT EXISTS idx_readiness_gate_overrides_user_id
    ON readiness_gate_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_readiness_gate_overrides_dimension_id
    ON readiness_gate_overrides(dimension_id);
CREATE INDEX IF NOT EXISTS idx_readiness_gate_overrides_is_active
    ON readiness_gate_overrides(is_active);

CREATE INDEX IF NOT EXISTS idx_persona_progression_gates_project_id
    ON persona_progression_gates(project_id);
CREATE INDEX IF NOT EXISTS idx_persona_progression_gates_persona_type
    ON persona_progression_gates(persona_type);
CREATE INDEX IF NOT EXISTS idx_persona_progression_gates_is_active
    ON persona_progression_gates(is_active);

-- Add updated_at triggers
DROP TRIGGER IF EXISTS set_timestamp_readiness_gate_overrides ON readiness_gate_overrides;
CREATE TRIGGER set_timestamp_readiness_gate_overrides
    BEFORE UPDATE ON readiness_gate_overrides
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_persona_progression_gates ON persona_progression_gates;
CREATE TRIGGER set_timestamp_persona_progression_gates
    BEFORE UPDATE ON persona_progression_gates
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();