import { db } from '../config/database';
import { PersonaInvocation, CreatePersonaInvocationRequest, PersonaInvocationWithDetails, User, Requirement, RefinementSession } from './types';

export class PersonaInvocationModel {
  // Create a new persona invocation
  static async create(data: CreatePersonaInvocationRequest, user_id: string): Promise<PersonaInvocation> {
    const result = await db.query(
      `INSERT INTO persona_invocations (
        requirement_id, session_id, user_id, persona_name, persona_type,
        persona_description, invocation_reason, trigger_context,
        contributed_dimensions, dimension_summary, invocation_metadata
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        data.requirement_id,
        data.session_id,
        user_id,
        data.persona_name,
        data.persona_type,
        data.persona_description,
        data.invocation_reason,
        data.trigger_context ? JSON.stringify(data.trigger_context) : null,
        JSON.stringify(data.contributed_dimensions || []),
        data.dimension_summary,
        data.invocation_metadata ? JSON.stringify(data.invocation_metadata) : '{}'
      ]
    );

    return result.rows[0];
  }

  // Get persona invocation by ID
  static async findById(id: string): Promise<PersonaInvocation | null> {
    const result = await db.query(
      'SELECT * FROM persona_invocations WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get persona invocation by ID with full details
  static async findByIdWithDetails(id: string): Promise<PersonaInvocationWithDetails | null> {
    const result = await db.query(
      `SELECT pi.*,
              JSON_BUILD_OBJECT(
                'id', r.id,
                'title', r.title,
                'description', r.description,
                'project_id', r.project_id,
                'priority', r.priority,
                'status', r.status,
                'type', r.type
              ) as requirement,
              JSON_BUILD_OBJECT(
                'id', rs.id,
                'session_name', rs.session_name,
                'status', rs.status,
                'created_at', rs.created_at
              ) as session,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user
       FROM persona_invocations pi
       INNER JOIN requirements r ON pi.requirement_id = r.id
       INNER JOIN refinement_sessions rs ON pi.session_id = rs.id
       INNER JOIN users u ON pi.user_id = u.id
       WHERE pi.id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  // Get persona invocations by requirement ID
  static async findByRequirementId(requirement_id: string): Promise<PersonaInvocation[]> {
    const result = await db.query(
      `SELECT * FROM persona_invocations
       WHERE requirement_id = $1
       ORDER BY invoked_at DESC`,
      [requirement_id]
    );

    return result.rows;
  }

  // Get persona invocations by session ID
  static async findBySessionId(session_id: string): Promise<PersonaInvocation[]> {
    const result = await db.query(
      `SELECT * FROM persona_invocations
       WHERE session_id = $1
       ORDER BY invoked_at DESC`,
      [session_id]
    );

    return result.rows;
  }

  // Get persona invocations by user ID (for audit trail)
  static async findByUserId(user_id: string): Promise<PersonaInvocationWithDetails[]> {
    const result = await db.query(
      `SELECT pi.*,
              JSON_BUILD_OBJECT(
                'id', r.id,
                'title', r.title,
                'description', r.description,
                'project_id', r.project_id,
                'priority', r.priority,
                'status', r.status,
                'type', r.type
              ) as requirement,
              JSON_BUILD_OBJECT(
                'id', rs.id,
                'session_name', rs.session_name,
                'status', rs.status,
                'created_at', rs.created_at
              ) as session,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user
       FROM persona_invocations pi
       INNER JOIN requirements r ON pi.requirement_id = r.id
       INNER JOIN refinement_sessions rs ON pi.session_id = rs.id
       INNER JOIN users u ON pi.user_id = u.id
       WHERE pi.user_id = $1
       ORDER BY pi.invoked_at DESC`,
      [user_id]
    );

    return result.rows;
  }

  // Get persona invocations with pagination and filtering
  static async findWithFilters(filters: {
    requirement_id?: string;
    session_id?: string;
    user_id?: string;
    persona_type?: string;
    invocation_status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ invocations: PersonaInvocationWithDetails[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.requirement_id) {
      conditions.push(`pi.requirement_id = $${paramIndex++}`);
      values.push(filters.requirement_id);
    }

    if (filters.session_id) {
      conditions.push(`pi.session_id = $${paramIndex++}`);
      values.push(filters.session_id);
    }

    if (filters.user_id) {
      conditions.push(`pi.user_id = $${paramIndex++}`);
      values.push(filters.user_id);
    }

    if (filters.persona_type) {
      conditions.push(`pi.persona_type = $${paramIndex++}`);
      values.push(filters.persona_type);
    }

    if (filters.invocation_status) {
      conditions.push(`pi.invocation_status = $${paramIndex++}`);
      values.push(filters.invocation_status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total
       FROM persona_invocations pi
       INNER JOIN requirements r ON pi.requirement_id = r.id
       INNER JOIN refinement_sessions rs ON pi.session_id = rs.id
       INNER JOIN users u ON pi.user_id = u.id
       ${whereClause}`,
      values
    );

    const total = parseInt(countResult.rows[0].total);

    // Add limit and offset
    if (filters.limit) {
      values.push(filters.limit);
      paramIndex++;
    }

    if (filters.offset) {
      values.push(filters.offset);
      paramIndex++;
    }

    const limitClause = filters.limit ? `LIMIT $${paramIndex - (filters.offset ? 2 : 1)}` : '';
    const offsetClause = filters.offset ? `OFFSET $${paramIndex - 1}` : '';

    // Get filtered results
    const result = await db.query(
      `SELECT pi.*,
              JSON_BUILD_OBJECT(
                'id', r.id,
                'title', r.title,
                'description', r.description,
                'project_id', r.project_id,
                'priority', r.priority,
                'status', r.status,
                'type', r.type
              ) as requirement,
              JSON_BUILD_OBJECT(
                'id', rs.id,
                'session_name', rs.session_name,
                'status', rs.status,
                'created_at', rs.created_at
              ) as session,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user
       FROM persona_invocations pi
       INNER JOIN requirements r ON pi.requirement_id = r.id
       INNER JOIN refinement_sessions rs ON pi.session_id = rs.id
       INNER JOIN users u ON pi.user_id = u.id
       ${whereClause}
       ORDER BY pi.invoked_at DESC
       ${limitClause} ${offsetClause}`,
      values
    );

    return {
      invocations: result.rows,
      total
    };
  }

  // Update persona invocation
  static async update(id: string, data: Partial<CreatePersonaInvocationRequest>): Promise<PersonaInvocation | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.persona_name !== undefined) {
      fields.push(`persona_name = $${paramIndex++}`);
      values.push(data.persona_name);
    }

    if (data.persona_type !== undefined) {
      fields.push(`persona_type = $${paramIndex++}`);
      values.push(data.persona_type);
    }

    if (data.persona_description !== undefined) {
      fields.push(`persona_description = $${paramIndex++}`);
      values.push(data.persona_description);
    }

    if (data.invocation_reason !== undefined) {
      fields.push(`invocation_reason = $${paramIndex++}`);
      values.push(data.invocation_reason);
    }

    if (data.trigger_context !== undefined) {
      fields.push(`trigger_context = $${paramIndex++}`);
      values.push(data.trigger_context ? JSON.stringify(data.trigger_context) : null);
    }

    if (data.contributed_dimensions !== undefined) {
      fields.push(`contributed_dimensions = $${paramIndex++}`);
      values.push(JSON.stringify(data.contributed_dimensions || []));
    }

    if (data.dimension_summary !== undefined) {
      fields.push(`dimension_summary = $${paramIndex++}`);
      values.push(data.dimension_summary);
    }

    if (data.invocation_metadata !== undefined) {
      fields.push(`invocation_metadata = $${paramIndex++}`);
      values.push(data.invocation_metadata ? JSON.stringify(data.invocation_metadata) : '{}');
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await db.query(
      `UPDATE persona_invocations SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Update invocation status
  static async updateStatus(id: string, status: 'pending' | 'completed' | 'failed'): Promise<PersonaInvocation | null> {
    const result = await db.query(
      `UPDATE persona_invocations
       SET invocation_status = $1,
           completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    return result.rows[0] || null;
  }

  // Mark invocation as completed
  static async markCompleted(id: string): Promise<PersonaInvocation | null> {
    return this.updateStatus(id, 'completed');
  }

  // Check if user can access persona invocation (via requirement access)
  static async canUserAccess(invocation_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM persona_invocations pi
       INNER JOIN requirements r ON pi.requirement_id = r.id
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       WHERE pi.id = $1 AND wm.user_id = $2`,
      [invocation_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Get persona invocation statistics
  static async getInvocationStats(filters?: {
    requirement_id?: string;
    session_id?: string;
    user_id?: string;
    date_range?: { start: Date; end: Date };
  }): Promise<{
    total_invocations: number;
    by_persona_type: { persona_type: string; count: number }[];
    by_status: { status: string; count: number }[];
    avg_contributions_per_invocation: number;
  }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.requirement_id) {
      conditions.push(`requirement_id = $${paramIndex++}`);
      values.push(filters.requirement_id);
    }

    if (filters?.session_id) {
      conditions.push(`session_id = $${paramIndex++}`);
      values.push(filters.session_id);
    }

    if (filters?.user_id) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(filters.user_id);
    }

    if (filters?.date_range) {
      conditions.push(`invoked_at >= $${paramIndex++}`);
      conditions.push(`invoked_at <= $${paramIndex++}`);
      values.push(filters.date_range.start, filters.date_range.end);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get comprehensive stats
    const result = await db.query(`
      SELECT
        COUNT(*) as total_invocations,
        COALESCE(AVG(jsonb_array_length(contributed_dimensions)), 0) as avg_contributions_per_invocation,
        json_agg(DISTINCT jsonb_build_object('persona_type', persona_type, 'count', persona_type_counts.count)) as by_persona_type,
        json_agg(DISTINCT jsonb_build_object('status', invocation_status, 'count', status_counts.count)) as by_status
      FROM persona_invocations pi
      LEFT JOIN (
        SELECT persona_type, COUNT(*) as count
        FROM persona_invocations
        ${whereClause}
        GROUP BY persona_type
      ) persona_type_counts ON pi.persona_type = persona_type_counts.persona_type
      LEFT JOIN (
        SELECT invocation_status, COUNT(*) as count
        FROM persona_invocations
        ${whereClause}
        GROUP BY invocation_status
      ) status_counts ON pi.invocation_status = status_counts.invocation_status
      ${whereClause}
    `, values);

    const stats = result.rows[0];
    return {
      total_invocations: parseInt(stats.total_invocations || '0'),
      by_persona_type: stats.by_persona_type || [],
      by_status: stats.by_status || [],
      avg_contributions_per_invocation: parseFloat(stats.avg_contributions_per_invocation || '0')
    };
  }
}