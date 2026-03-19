import { db } from '../config/database';
import { RefinementSession, CreateRefinementSessionRequest, RefinementSessionWithDetails, RefinementMessage, CreateRefinementMessageRequest, User, Requirement } from './types';

export class RefinementSessionModel {
  // Create a new refinement session
  static async create(data: CreateRefinementSessionRequest, user_id: string): Promise<RefinementSession> {
    const result = await db.query(
      `INSERT INTO refinement_sessions (
        requirement_id, user_id, session_name, status, session_metadata
      )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.requirement_id,
        user_id,
        data.session_name,
        data.status || 'active',
        data.session_metadata ? JSON.stringify(data.session_metadata) : '{}'
      ]
    );

    return result.rows[0];
  }

  // Get refinement session by ID
  static async findById(id: string): Promise<RefinementSession | null> {
    const result = await db.query(
      'SELECT * FROM refinement_sessions WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get refinement session by ID with full details
  static async findByIdWithDetails(id: string): Promise<RefinementSessionWithDetails | null> {
    const result = await db.query(
      `SELECT rs.*,
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
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user
       FROM refinement_sessions rs
       INNER JOIN requirements r ON rs.requirement_id = r.id
       INNER JOIN users u ON rs.user_id = u.id
       WHERE rs.id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  // Get refinement sessions by requirement ID
  static async findByRequirementId(requirement_id: string): Promise<RefinementSession[]> {
    const result = await db.query(
      `SELECT * FROM refinement_sessions
       WHERE requirement_id = $1
       ORDER BY created_at DESC`,
      [requirement_id]
    );

    return result.rows;
  }

  // Get refinement sessions by user ID
  static async findByUserId(user_id: string): Promise<RefinementSessionWithDetails[]> {
    const result = await db.query(
      `SELECT rs.*,
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
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user
       FROM refinement_sessions rs
       INNER JOIN requirements r ON rs.requirement_id = r.id
       INNER JOIN users u ON rs.user_id = u.id
       WHERE rs.user_id = $1
       ORDER BY rs.created_at DESC`,
      [user_id]
    );

    return result.rows;
  }

  // Update refinement session
  static async update(id: string, data: Partial<CreateRefinementSessionRequest>): Promise<RefinementSession | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.session_name !== undefined) {
      fields.push(`session_name = $${paramIndex++}`);
      values.push(data.session_name);
    }

    if (data.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (data.session_metadata !== undefined) {
      fields.push(`session_metadata = $${paramIndex++}`);
      values.push(data.session_metadata ? JSON.stringify(data.session_metadata) : '{}');
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await db.query(
      `UPDATE refinement_sessions SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Update session status
  static async updateStatus(id: string, status: 'active' | 'completed' | 'archived'): Promise<RefinementSession | null> {
    const result = await db.query(
      `UPDATE refinement_sessions SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    return result.rows[0] || null;
  }

  // Check if user can access refinement session (via requirement access)
  static async canUserAccess(session_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM refinement_sessions rs
       INNER JOIN requirements r ON rs.requirement_id = r.id
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       WHERE rs.id = $1 AND wm.user_id = $2`,
      [session_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }
}

export class RefinementMessageModel {
  // Create a new refinement message
  static async create(data: CreateRefinementMessageRequest, user_id: string): Promise<RefinementMessage> {
    const result = await db.query(
      `INSERT INTO refinement_messages (
        session_id, user_id, message_type, content, message_metadata
      )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.session_id,
        user_id,
        data.message_type,
        data.content,
        data.message_metadata ? JSON.stringify(data.message_metadata) : '{}'
      ]
    );

    return result.rows[0];
  }

  // Get messages by session ID
  static async findBySessionId(session_id: string): Promise<RefinementMessage[]> {
    const result = await db.query(
      `SELECT * FROM refinement_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [session_id]
    );

    return result.rows;
  }

  // Get messages by session ID with user details
  static async findBySessionIdWithUsers(session_id: string): Promise<any[]> {
    const result = await db.query(
      `SELECT rm.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user
       FROM refinement_messages rm
       INNER JOIN users u ON rm.user_id = u.id
       WHERE rm.session_id = $1
       ORDER BY rm.created_at ASC`,
      [session_id]
    );

    return result.rows;
  }

  // Get message by ID
  static async findById(id: string): Promise<RefinementMessage | null> {
    const result = await db.query(
      'SELECT * FROM refinement_messages WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Check if user can access refinement message (via session access)
  static async canUserAccess(message_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM refinement_messages rm
       INNER JOIN refinement_sessions rs ON rm.session_id = rs.id
       INNER JOIN requirements r ON rs.requirement_id = r.id
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       WHERE rm.id = $1 AND wm.user_id = $2`,
      [message_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }
}