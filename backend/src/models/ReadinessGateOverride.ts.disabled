import { db } from '../config/database';
import {
  ReadinessGateOverride,
  ReadinessGateOverrideWithUser,
  PersonaProgressionGate,
  CreateReadinessGateOverrideRequest,
  UpdateReadinessGateOverrideRequest,
  CreatePersonaProgressionGateRequest,
  UpdatePersonaProgressionGateRequest,
  User
} from './types';

export class ReadinessGateOverrideModel {
  // Create a new readiness gate override
  static async create(data: CreateReadinessGateOverrideRequest, user_id: string): Promise<ReadinessGateOverride> {
    const result = await db.query(
      `INSERT INTO readiness_gate_overrides (
        requirement_id, user_id, dimension_id, dimension_name,
        override_reason, original_score, override_score, override_type, expires_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.requirement_id,
        user_id,
        data.dimension_id,
        data.dimension_name,
        data.override_reason,
        data.original_score || 0,
        data.override_score || 100,
        data.override_type || 'manual',
        data.expires_at
      ]
    );

    return result.rows[0];
  }

  // Get override by ID
  static async findById(id: string): Promise<ReadinessGateOverride | null> {
    const result = await db.query(
      'SELECT * FROM readiness_gate_overrides WHERE id = $1 AND is_active = true',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get override by ID with user details
  static async findByIdWithUser(id: string): Promise<ReadinessGateOverrideWithUser | null> {
    const result = await db.query(
      `SELECT rgo.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user
       FROM readiness_gate_overrides rgo
       INNER JOIN users u ON rgo.user_id = u.id
       WHERE rgo.id = $1 AND rgo.is_active = true`,
      [id]
    );

    return result.rows[0] || null;
  }

  // Get all overrides for a requirement
  static async findByRequirementId(requirement_id: string): Promise<ReadinessGateOverrideWithUser[]> {
    const result = await db.query(
      `SELECT rgo.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user
       FROM readiness_gate_overrides rgo
       INNER JOIN users u ON rgo.user_id = u.id
       WHERE rgo.requirement_id = $1 AND rgo.is_active = true
       ORDER BY rgo.created_at DESC`,
      [requirement_id]
    );

    return result.rows;
  }

  // Get specific override for requirement and dimension
  static async findByRequirementAndDimension(
    requirement_id: string,
    dimension_id: string
  ): Promise<ReadinessGateOverrideWithUser | null> {
    const result = await db.query(
      `SELECT rgo.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user
       FROM readiness_gate_overrides rgo
       INNER JOIN users u ON rgo.user_id = u.id
       WHERE rgo.requirement_id = $1 AND rgo.dimension_id = $2 AND rgo.is_active = true
       ORDER BY rgo.created_at DESC
       LIMIT 1`,
      [requirement_id, dimension_id]
    );

    return result.rows[0] || null;
  }

  // Update override
  static async update(id: string, data: UpdateReadinessGateOverrideRequest): Promise<ReadinessGateOverride | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.override_reason !== undefined) {
      fields.push(`override_reason = $${paramIndex++}`);
      values.push(data.override_reason);
    }

    if (data.override_score !== undefined) {
      fields.push(`override_score = $${paramIndex++}`);
      values.push(data.override_score);
    }

    if (data.expires_at !== undefined) {
      fields.push(`expires_at = $${paramIndex++}`);
      values.push(data.expires_at);
    }

    if (data.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await db.query(
      `UPDATE readiness_gate_overrides SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex} AND is_active = true
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Delete override (soft delete)
  static async delete(id: string): Promise<boolean> {
    const result = await db.query(
      'UPDATE readiness_gate_overrides SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user can access override (via requirement access)
  static async canUserAccess(override_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM readiness_gate_overrides rgo
       INNER JOIN requirements r ON rgo.requirement_id = r.id
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       WHERE rgo.id = $1 AND wm.user_id = $2 AND rgo.is_active = true AND r.is_active = true`,
      [override_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }
}

export class PersonaProgressionGateModel {
  // Create a new persona progression gate
  static async create(data: CreatePersonaProgressionGateRequest): Promise<PersonaProgressionGate> {
    const result = await db.query(
      `INSERT INTO persona_progression_gates (
        project_id, gate_name, gate_description, required_dimensions,
        minimum_score, allow_overrides, persona_type, gate_order
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.project_id,
        data.gate_name,
        data.gate_description,
        JSON.stringify(data.required_dimensions || []),
        data.minimum_score || 80,
        data.allow_overrides !== false,
        data.persona_type,
        data.gate_order || 0
      ]
    );

    return result.rows[0];
  }

  // Get gate by ID
  static async findById(id: string): Promise<PersonaProgressionGate | null> {
    const result = await db.query(
      'SELECT * FROM persona_progression_gates WHERE id = $1 AND is_active = true',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get all gates for a project
  static async findByProjectId(project_id: string): Promise<PersonaProgressionGate[]> {
    const result = await db.query(
      `SELECT * FROM persona_progression_gates
       WHERE project_id = $1 AND is_active = true
       ORDER BY gate_order ASC, created_at ASC`,
      [project_id]
    );

    return result.rows;
  }

  // Get gates by persona type
  static async findByPersonaType(project_id: string, persona_type: string): Promise<PersonaProgressionGate[]> {
    const result = await db.query(
      `SELECT * FROM persona_progression_gates
       WHERE project_id = $1 AND persona_type = $2 AND is_active = true
       ORDER BY gate_order ASC, created_at ASC`,
      [project_id, persona_type]
    );

    return result.rows;
  }

  // Update gate
  static async update(id: string, data: UpdatePersonaProgressionGateRequest): Promise<PersonaProgressionGate | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.gate_name !== undefined) {
      fields.push(`gate_name = $${paramIndex++}`);
      values.push(data.gate_name);
    }

    if (data.gate_description !== undefined) {
      fields.push(`gate_description = $${paramIndex++}`);
      values.push(data.gate_description);
    }

    if (data.required_dimensions !== undefined) {
      fields.push(`required_dimensions = $${paramIndex++}`);
      values.push(JSON.stringify(data.required_dimensions));
    }

    if (data.minimum_score !== undefined) {
      fields.push(`minimum_score = $${paramIndex++}`);
      values.push(data.minimum_score);
    }

    if (data.allow_overrides !== undefined) {
      fields.push(`allow_overrides = $${paramIndex++}`);
      values.push(data.allow_overrides);
    }

    if (data.persona_type !== undefined) {
      fields.push(`persona_type = $${paramIndex++}`);
      values.push(data.persona_type);
    }

    if (data.gate_order !== undefined) {
      fields.push(`gate_order = $${paramIndex++}`);
      values.push(data.gate_order);
    }

    if (data.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await db.query(
      `UPDATE persona_progression_gates SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex} AND is_active = true
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Delete gate (soft delete)
  static async delete(id: string): Promise<boolean> {
    const result = await db.query(
      'UPDATE persona_progression_gates SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }
}