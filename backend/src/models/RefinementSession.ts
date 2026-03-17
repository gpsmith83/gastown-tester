import { db } from '../config/database';
import {
  RefinementSession,
  RefinementSessionWithDetails,
  CreateRefinementSessionRequest,
  UpdateRefinementSessionRequest
} from './types';

export class RefinementSessionModel {
  // Create a new refinement session
  static async create(data: CreateRefinementSessionRequest, user_id: string): Promise<RefinementSession> {
    const result = await db.query(
      `INSERT INTO refinement_sessions (
        requirement_id, user_id, title, description
      )
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        data.requirement_id,
        user_id,
        data.title,
        data.description
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

  // Get refinement session by ID with requirement and user details
  static async findByIdWithDetails(id: string): Promise<RefinementSessionWithDetails | null> {
    const result = await db.query(
      `SELECT s.*,
              JSON_BUILD_OBJECT(
                'id', r.id,
                'title', r.title,
                'description', r.description,
                'project_id', r.project_id,
                'author_id', r.author_id,
                'priority', r.priority,
                'status', r.status,
                'type', r.type,
                'github_issue_number', r.github_issue_number,
                'github_issue_url', r.github_issue_url,
                'is_active', r.is_active,
                'created_at', r.created_at,
                'updated_at', r.updated_at,
                'project', JSON_BUILD_OBJECT(
                  'id', p.id,
                  'name', p.name,
                  'description', p.description,
                  'workspace_id', p.workspace_id,
                  'owner_id', p.owner_id,
                  'created_at', p.created_at,
                  'updated_at', p.updated_at
                ),
                'author', JSON_BUILD_OBJECT(
                  'id', ra.id,
                  'username', ra.username,
                  'email', ra.email,
                  'name', ra.name,
                  'avatar_url', ra.avatar_url
                )
              ) as requirement,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user,
              (SELECT COUNT(*) FROM requirement_messages WHERE session_id = s.id) as message_count
       FROM refinement_sessions s
       INNER JOIN requirements r ON s.requirement_id = r.id
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN users ra ON r.author_id = ra.id
       INNER JOIN users u ON s.user_id = u.id
       WHERE s.id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  // Get all refinement sessions for a requirement
  static async findByRequirementId(requirement_id: string): Promise<RefinementSessionWithDetails[]> {
    const result = await db.query(
      `SELECT s.*,
              JSON_BUILD_OBJECT(
                'id', r.id,
                'title', r.title,
                'description', r.description,
                'project_id', r.project_id,
                'author_id', r.author_id,
                'priority', r.priority,
                'status', r.status,
                'type', r.type,
                'github_issue_number', r.github_issue_number,
                'github_issue_url', r.github_issue_url,
                'is_active', r.is_active,
                'created_at', r.created_at,
                'updated_at', r.updated_at,
                'project', JSON_BUILD_OBJECT(
                  'id', p.id,
                  'name', p.name,
                  'description', p.description,
                  'workspace_id', p.workspace_id,
                  'owner_id', p.owner_id,
                  'created_at', p.created_at,
                  'updated_at', p.updated_at
                ),
                'author', JSON_BUILD_OBJECT(
                  'id', ra.id,
                  'username', ra.username,
                  'email', ra.email,
                  'name', ra.name,
                  'avatar_url', ra.avatar_url
                )
              ) as requirement,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user,
              (SELECT COUNT(*) FROM requirement_messages WHERE session_id = s.id) as message_count
       FROM refinement_sessions s
       INNER JOIN requirements r ON s.requirement_id = r.id
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN users ra ON r.author_id = ra.id
       INNER JOIN users u ON s.user_id = u.id
       WHERE s.requirement_id = $1
       ORDER BY s.started_at DESC`,
      [requirement_id]
    );

    return result.rows;
  }

  // Get refinement sessions created by a user
  static async findByUserId(user_id: string): Promise<RefinementSessionWithDetails[]> {
    const result = await db.query(
      `SELECT s.*,
              JSON_BUILD_OBJECT(
                'id', r.id,
                'title', r.title,
                'description', r.description,
                'project_id', r.project_id,
                'author_id', r.author_id,
                'priority', r.priority,
                'status', r.status,
                'type', r.type,
                'github_issue_number', r.github_issue_number,
                'github_issue_url', r.github_issue_url,
                'is_active', r.is_active,
                'created_at', r.created_at,
                'updated_at', r.updated_at,
                'project', JSON_BUILD_OBJECT(
                  'id', p.id,
                  'name', p.name,
                  'description', p.description,
                  'workspace_id', p.workspace_id,
                  'owner_id', p.owner_id,
                  'created_at', p.created_at,
                  'updated_at', p.updated_at
                ),
                'author', JSON_BUILD_OBJECT(
                  'id', ra.id,
                  'username', ra.username,
                  'email', ra.email,
                  'name', ra.name,
                  'avatar_url', ra.avatar_url
                )
              ) as requirement,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user,
              (SELECT COUNT(*) FROM requirement_messages WHERE session_id = s.id) as message_count
       FROM refinement_sessions s
       INNER JOIN requirements r ON s.requirement_id = r.id
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN users ra ON r.author_id = ra.id
       INNER JOIN users u ON s.user_id = u.id
       WHERE s.user_id = $1
       ORDER BY s.started_at DESC`,
      [user_id]
    );

    return result.rows;
  }

  // Get refinement sessions accessible to a user (via project/workspace access)
  static async findAccessibleByUser(user_id: string): Promise<RefinementSessionWithDetails[]> {
    const result = await db.query(
      `SELECT s.*,
              JSON_BUILD_OBJECT(
                'id', r.id,
                'title', r.title,
                'description', r.description,
                'project_id', r.project_id,
                'author_id', r.author_id,
                'priority', r.priority,
                'status', r.status,
                'type', r.type,
                'github_issue_number', r.github_issue_number,
                'github_issue_url', r.github_issue_url,
                'is_active', r.is_active,
                'created_at', r.created_at,
                'updated_at', r.updated_at,
                'project', JSON_BUILD_OBJECT(
                  'id', p.id,
                  'name', p.name,
                  'description', p.description,
                  'workspace_id', p.workspace_id,
                  'owner_id', p.owner_id,
                  'created_at', p.created_at,
                  'updated_at', p.updated_at
                ),
                'author', JSON_BUILD_OBJECT(
                  'id', ra.id,
                  'username', ra.username,
                  'email', ra.email,
                  'name', ra.name,
                  'avatar_url', ra.avatar_url
                )
              ) as requirement,
              JSON_BUILD_OBJECT(
                'id', su.id,
                'username', su.username,
                'email', su.email,
                'name', su.name,
                'avatar_url', su.avatar_url
              ) as user,
              (SELECT COUNT(*) FROM requirement_messages WHERE session_id = s.id) as message_count
       FROM refinement_sessions s
       INNER JOIN requirements r ON s.requirement_id = r.id AND r.is_active = true
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       INNER JOIN users ra ON r.author_id = ra.id
       INNER JOIN users su ON s.user_id = su.id
       WHERE wm.user_id = $1
       ORDER BY s.started_at DESC`,
      [user_id]
    );

    return result.rows;
  }

  // Update refinement session
  static async update(id: string, data: UpdateRefinementSessionRequest): Promise<RefinementSession | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }

    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }

    if (data.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(data.status);

      // Set completed_at when status changes to completed
      if (data.status === 'completed') {
        fields.push(`completed_at = NOW()`);
      } else if (data.status === 'active' || data.status === 'paused') {
        fields.push(`completed_at = NULL`);
      }
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

  // Delete refinement session (hard delete - also deletes associated messages due to CASCADE)
  static async delete(id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM refinement_sessions WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user can access refinement session (via requirement access)
  static async canUserAccess(session_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM refinement_sessions s
       INNER JOIN requirements r ON s.requirement_id = r.id AND r.is_active = true
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       WHERE s.id = $1 AND wm.user_id = $2`,
      [session_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user owns/created the refinement session
  static async isUserOwner(session_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      'SELECT 1 FROM refinement_sessions WHERE id = $1 AND user_id = $2',
      [session_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Get active sessions for a requirement
  static async findActiveByRequirementId(requirement_id: string): Promise<RefinementSession[]> {
    const result = await db.query(
      `SELECT * FROM refinement_sessions
       WHERE requirement_id = $1 AND status = 'active'
       ORDER BY started_at DESC`,
      [requirement_id]
    );

    return result.rows;
  }
}