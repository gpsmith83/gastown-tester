import { db } from '../config/database';
import {
  RefinementSession,
  RefinementSessionWithDetails,
  CreateRefinementSessionRequest
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