import { db } from '../config/database';
import {
  RequirementMessage,
  RequirementMessageWithDetails,
  CreateRequirementMessageRequest,
  UpdateRequirementMessageRequest
} from './types';

export class RequirementMessageModel {
  // Create a new requirement message
  static async create(data: CreateRequirementMessageRequest, author_id?: string): Promise<RequirementMessage> {
    // Get the next sequence number for this session
    const sequenceResult = await db.query(
      `SELECT COALESCE(MAX(sequence_number), 0) + 1 as next_sequence
       FROM requirement_messages WHERE session_id = $1`,
      [data.session_id]
    );

    const sequence_number = sequenceResult.rows[0]?.next_sequence || 1;

    const result = await db.query(
      `INSERT INTO requirement_messages (
        requirement_id, session_id, author_id, message_type, content,
        role, metadata, sequence_number, parent_message_id
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.requirement_id,
        data.session_id,
        author_id,
        data.message_type || 'user_message',
        data.content,
        data.role,
        data.metadata ? JSON.stringify(data.metadata) : null,
        sequence_number,
        data.parent_message_id
      ]
    );

    return result.rows[0];
  }

  // Get requirement message by ID
  static async findById(id: string): Promise<RequirementMessage | null> {
    const result = await db.query(
      'SELECT * FROM requirement_messages WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get requirement message by ID with related details
  static async findByIdWithDetails(id: string): Promise<RequirementMessageWithDetails | null> {
    const result = await db.query(
      `SELECT m.*,
              CASE
                WHEN m.author_id IS NOT NULL THEN
                  JSON_BUILD_OBJECT(
                    'id', u.id,
                    'username', u.username,
                    'email', u.email,
                    'name', u.name,
                    'avatar_url', u.avatar_url
                  )
                ELSE NULL
              END as author,
              JSON_BUILD_OBJECT(
                'id', r.id,
                'title', r.title,
                'description', r.description,
                'project_id', r.project_id,
                'author_id', r.author_id,
                'priority', r.priority,
                'status', r.status,
                'type', r.type,
                'created_at', r.created_at,
                'updated_at', r.updated_at
              ) as requirement,
              JSON_BUILD_OBJECT(
                'id', s.id,
                'requirement_id', s.requirement_id,
                'user_id', s.user_id,
                'title', s.title,
                'description', s.description,
                'status', s.status,
                'started_at', s.started_at,
                'completed_at', s.completed_at,
                'created_at', s.created_at,
                'updated_at', s.updated_at
              ) as session
       FROM requirement_messages m
       LEFT JOIN users u ON m.author_id = u.id
       INNER JOIN requirements r ON m.requirement_id = r.id
       INNER JOIN refinement_sessions s ON m.session_id = s.id
       WHERE m.id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  // Get all messages for a session in chronological order
  static async findBySessionId(session_id: string): Promise<RequirementMessageWithDetails[]> {
    const result = await db.query(
      `SELECT m.*,
              CASE
                WHEN m.author_id IS NOT NULL THEN
                  JSON_BUILD_OBJECT(
                    'id', u.id,
                    'username', u.username,
                    'email', u.email,
                    'name', u.name,
                    'avatar_url', u.avatar_url
                  )
                ELSE NULL
              END as author,
              JSON_BUILD_OBJECT(
                'id', r.id,
                'title', r.title,
                'description', r.description,
                'project_id', r.project_id,
                'author_id', r.author_id,
                'priority', r.priority,
                'status', r.status,
                'type', r.type,
                'created_at', r.created_at,
                'updated_at', r.updated_at
              ) as requirement,
              JSON_BUILD_OBJECT(
                'id', s.id,
                'requirement_id', s.requirement_id,
                'user_id', s.user_id,
                'title', s.title,
                'description', s.description,
                'status', s.status,
                'started_at', s.started_at,
                'completed_at', s.completed_at,
                'created_at', s.created_at,
                'updated_at', s.updated_at
              ) as session
       FROM requirement_messages m
       LEFT JOIN users u ON m.author_id = u.id
       INNER JOIN requirements r ON m.requirement_id = r.id
       INNER JOIN refinement_sessions s ON m.session_id = s.id
       WHERE m.session_id = $1
       ORDER BY m.sequence_number ASC, m.created_at ASC`,
      [session_id]
    );

    return result.rows;
  }

  // Get all messages for a requirement across all sessions
  static async findByRequirementId(requirement_id: string): Promise<RequirementMessageWithDetails[]> {
    const result = await db.query(
      `SELECT m.*,
              CASE
                WHEN m.author_id IS NOT NULL THEN
                  JSON_BUILD_OBJECT(
                    'id', u.id,
                    'username', u.username,
                    'email', u.email,
                    'name', u.name,
                    'avatar_url', u.avatar_url
                  )
                ELSE NULL
              END as author,
              JSON_BUILD_OBJECT(
                'id', r.id,
                'title', r.title,
                'description', r.description,
                'project_id', r.project_id,
                'author_id', r.author_id,
                'priority', r.priority,
                'status', r.status,
                'type', r.type,
                'created_at', r.created_at,
                'updated_at', r.updated_at
              ) as requirement,
              JSON_BUILD_OBJECT(
                'id', s.id,
                'requirement_id', s.requirement_id,
                'user_id', s.user_id,
                'title', s.title,
                'description', s.description,
                'status', s.status,
                'started_at', s.started_at,
                'completed_at', s.completed_at,
                'created_at', s.created_at,
                'updated_at', s.updated_at
              ) as session
       FROM requirement_messages m
       LEFT JOIN users u ON m.author_id = u.id
       INNER JOIN requirements r ON m.requirement_id = r.id
       INNER JOIN refinement_sessions s ON m.session_id = s.id
       WHERE m.requirement_id = $1
       ORDER BY s.started_at ASC, m.sequence_number ASC, m.created_at ASC`,
      [requirement_id]
    );

    return result.rows;
  }

  // Get messages authored by a user
  static async findByAuthorId(author_id: string): Promise<RequirementMessageWithDetails[]> {
    const result = await db.query(
      `SELECT m.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as author,
              JSON_BUILD_OBJECT(
                'id', r.id,
                'title', r.title,
                'description', r.description,
                'project_id', r.project_id,
                'author_id', r.author_id,
                'priority', r.priority,
                'status', r.status,
                'type', r.type,
                'created_at', r.created_at,
                'updated_at', r.updated_at
              ) as requirement,
              JSON_BUILD_OBJECT(
                'id', s.id,
                'requirement_id', s.requirement_id,
                'user_id', s.user_id,
                'title', s.title,
                'description', s.description,
                'status', s.status,
                'started_at', s.started_at,
                'completed_at', s.completed_at,
                'created_at', s.created_at,
                'updated_at', s.updated_at
              ) as session
       FROM requirement_messages m
       INNER JOIN users u ON m.author_id = u.id
       INNER JOIN requirements r ON m.requirement_id = r.id
       INNER JOIN refinement_sessions s ON m.session_id = s.id
       WHERE m.author_id = $1
       ORDER BY m.created_at DESC`,
      [author_id]
    );

    return result.rows;
  }

  // Get replies to a specific message
  static async findReplies(parent_message_id: string): Promise<RequirementMessage[]> {
    const result = await db.query(
      `SELECT * FROM requirement_messages
       WHERE parent_message_id = $1
       ORDER BY sequence_number ASC, created_at ASC`,
      [parent_message_id]
    );

    return result.rows;
  }

  // Update requirement message
  static async update(id: string, data: UpdateRequirementMessageRequest): Promise<RequirementMessage | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.content !== undefined) {
      fields.push(`content = $${paramIndex++}`);
      values.push(data.content);
    }

    if (data.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(data.metadata));
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await db.query(
      `UPDATE requirement_messages SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Delete requirement message
  static async delete(id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM requirement_messages WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user can access requirement message (via session/requirement access)
  static async canUserAccess(message_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM requirement_messages m
       INNER JOIN requirements r ON m.requirement_id = r.id AND r.is_active = true
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       WHERE m.id = $1 AND wm.user_id = $2`,
      [message_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user authored the message
  static async isUserAuthor(message_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      'SELECT 1 FROM requirement_messages WHERE id = $1 AND author_id = $2',
      [message_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Get message count for a session
  static async getSessionMessageCount(session_id: string): Promise<number> {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM requirement_messages WHERE session_id = $1',
      [session_id]
    );

    return parseInt(result.rows[0]?.count || '0');
  }

  // Get message count for a requirement across all sessions
  static async getRequirementMessageCount(requirement_id: string): Promise<number> {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM requirement_messages WHERE requirement_id = $1',
      [requirement_id]
    );

    return parseInt(result.rows[0]?.count || '0');
  }
}