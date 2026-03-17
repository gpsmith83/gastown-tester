-- Migration: Add persona orchestration rules for default progression
-- This implements B-302: Implement orchestration rules for default persona progression

-- Persona orchestration rules table
CREATE TABLE IF NOT EXISTS persona_orchestration_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- progression, trigger, sequence, conditional
    description TEXT,

    -- Rule logic
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of condition objects
    actions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of action objects

    -- Rule metadata
    priority INTEGER DEFAULT 3, -- 1=highest, 5=lowest
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure unique rule names
    UNIQUE(rule_name)
);

-- Persona progression configurations table
CREATE TABLE IF NOT EXISTS persona_progression_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    progression_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Default sequence of persona types
    default_sequence TEXT[] NOT NULL DEFAULT '{}', -- Array of persona type strings

    -- Associated rules
    rules JSONB DEFAULT '[]'::jsonb, -- Array of rule IDs or embedded rules

    -- Configuration metadata
    is_default BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure unique progression names
    UNIQUE(progression_name)
);

-- Persona orchestration execution log table
CREATE TABLE IF NOT EXISTS persona_orchestration_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID REFERENCES persona_orchestration_rules(id) ON DELETE CASCADE,

    -- Context for the execution
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,
    session_id UUID REFERENCES refinement_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Execution details
    trigger_event VARCHAR(255) NOT NULL,
    trigger_data JSONB,
    execution_status VARCHAR(50) DEFAULT 'pending', -- pending, executing, completed, failed

    -- Actions executed
    actions_executed JSONB DEFAULT '[]'::jsonb, -- Array of executed action objects
    execution_metadata JSONB DEFAULT '{}'::jsonb,

    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_persona_orchestration_rules_type ON persona_orchestration_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_persona_orchestration_rules_priority ON persona_orchestration_rules(priority);
CREATE INDEX IF NOT EXISTS idx_persona_orchestration_rules_active ON persona_orchestration_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_persona_progression_configs_default ON persona_progression_configs(is_default);

CREATE INDEX IF NOT EXISTS idx_persona_orchestration_executions_rule_id ON persona_orchestration_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_persona_orchestration_executions_requirement_id ON persona_orchestration_executions(requirement_id);
CREATE INDEX IF NOT EXISTS idx_persona_orchestration_executions_session_id ON persona_orchestration_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_persona_orchestration_executions_user_id ON persona_orchestration_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_persona_orchestration_executions_status ON persona_orchestration_executions(execution_status);
CREATE INDEX IF NOT EXISTS idx_persona_orchestration_executions_trigger_event ON persona_orchestration_executions(trigger_event);

-- Add triggers to update updated_at on record changes
DROP TRIGGER IF EXISTS set_timestamp_persona_orchestration_rules ON persona_orchestration_rules;
CREATE TRIGGER set_timestamp_persona_orchestration_rules
    BEFORE UPDATE ON persona_orchestration_rules
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_persona_progression_configs ON persona_progression_configs;
CREATE TRIGGER set_timestamp_persona_progression_configs
    BEFORE UPDATE ON persona_progression_configs
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- Insert default progression configuration
INSERT INTO persona_progression_configs (
    progression_name,
    description,
    default_sequence,
    is_default
) VALUES (
    'Default Software Development Progression',
    'Standard persona progression for software development requirements',
    ARRAY['business_analyst', 'architect', 'security_expert', 'ui_designer', 'developer', 'tester', 'devops_engineer'],
    true
) ON CONFLICT (progression_name) DO NOTHING;

-- Insert default orchestration rules

-- Rule 1: Auto-invoke business analyst for new requirements
INSERT INTO persona_orchestration_rules (
    rule_name,
    rule_type,
    description,
    conditions,
    actions,
    priority
) VALUES (
    'Auto Business Analyst for New Requirements',
    'trigger',
    'Automatically invoke business analyst persona when a new requirement is created',
    '[{
        "condition_type": "requirement_status",
        "operator": "equals",
        "expected_value": "draft",
        "condition_data": {"event": "requirement_created"}
    }]'::jsonb,
    '[{
        "action_type": "invoke_persona",
        "action_data": {
            "persona_type": "business_analyst",
            "persona_name": "Business Requirements Analyst",
            "persona_description": "Analyzes business requirements and clarifies stakeholder needs",
            "invocation_reason": "New requirement needs business analysis",
            "auto_invoked": true
        }
    }]'::jsonb,
    1
) ON CONFLICT (rule_name) DO NOTHING;

-- Rule 2: Progress to architect after business analysis
INSERT INTO persona_orchestration_rules (
    rule_name,
    rule_type,
    description,
    conditions,
    actions,
    priority
) VALUES (
    'Progress to Architect After Business Analysis',
    'progression',
    'Invoke architect persona after business analyst completes analysis',
    '[{
        "condition_type": "persona_invoked",
        "operator": "equals",
        "expected_value": "business_analyst",
        "condition_data": {"status": "completed"}
    }]'::jsonb,
    '[{
        "action_type": "invoke_persona",
        "action_data": {
            "persona_type": "architect",
            "persona_name": "Software Architect",
            "persona_description": "Designs system architecture and technical approach",
            "invocation_reason": "Business analysis completed, need technical architecture",
            "auto_invoked": true
        },
        "delay_seconds": 2
    }]'::jsonb,
    2
) ON CONFLICT (rule_name) DO NOTHING;

-- Rule 3: Security review after architecture
INSERT INTO persona_orchestration_rules (
    rule_name,
    rule_type,
    description,
    conditions,
    actions,
    priority
) VALUES (
    'Security Review After Architecture',
    'progression',
    'Invoke security expert after architect completes system design',
    '[{
        "condition_type": "persona_invoked",
        "operator": "equals",
        "expected_value": "architect",
        "condition_data": {"status": "completed"}
    }]'::jsonb,
    '[{
        "action_type": "invoke_persona",
        "action_data": {
            "persona_type": "security_expert",
            "persona_name": "Security Expert",
            "persona_description": "Reviews security implications and requirements",
            "invocation_reason": "Architecture completed, need security review",
            "auto_invoked": true
        },
        "delay_seconds": 3
    }]'::jsonb,
    2
) ON CONFLICT (rule_name) DO NOTHING;

-- Rule 4: UI/UX design for user-facing features
INSERT INTO persona_orchestration_rules (
    rule_name,
    rule_type,
    description,
    conditions,
    actions,
    priority
) VALUES (
    'UI Design for User-Facing Features',
    'conditional',
    'Invoke UI designer for requirements that involve user interfaces',
    '[{
        "condition_type": "dimension_contributed",
        "operator": "contains",
        "expected_value": "user interface",
        "condition_data": {"dimension_category": "functional"}
    }, {
        "condition_type": "persona_invoked",
        "operator": "equals",
        "expected_value": "architect",
        "condition_data": {"status": "completed"}
    }]'::jsonb,
    '[{
        "action_type": "invoke_persona",
        "action_data": {
            "persona_type": "ui_designer",
            "persona_name": "UI/UX Designer",
            "persona_description": "Designs user interface and user experience",
            "invocation_reason": "User interface components identified in requirement",
            "auto_invoked": true
        },
        "delay_seconds": 5
    }]'::jsonb,
    3
) ON CONFLICT (rule_name) DO NOTHING;

-- Rule 5: Developer implementation planning
INSERT INTO persona_orchestration_rules (
    rule_name,
    rule_type,
    description,
    conditions,
    actions,
    priority
) VALUES (
    'Developer Implementation Planning',
    'progression',
    'Invoke developer persona when design phase is complete',
    '[{
        "condition_type": "requirement_status",
        "operator": "equals",
        "expected_value": "active",
        "condition_data": {"min_personas_invoked": 2}
    }]'::jsonb,
    '[{
        "action_type": "invoke_persona",
        "action_data": {
            "persona_type": "developer",
            "persona_name": "Software Developer",
            "persona_description": "Plans implementation approach and identifies technical tasks",
            "invocation_reason": "Design phase completed, ready for implementation planning",
            "auto_invoked": true
        },
        "delay_seconds": 10
    }]'::jsonb,
    3
) ON CONFLICT (rule_name) DO NOTHING;