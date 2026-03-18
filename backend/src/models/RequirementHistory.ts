import { db } from '../config/database';
import { RequirementHistory, RequirementHistoryWithUser } from './types';

export class RequirementHistoryModel {
  // Log a change to a requirement
  static async logChange(
    requirement_id: string,
    changed_by: string,
    field_name: string,
    old_value?: string,
    new_value?: string,
    change_reason?: string
  ): Promise<RequirementHistory> {
    const result = await db.query(
      `INSERT INTO requirement_history (
        requirement_id, changed_by, field_name, old_value, new_value, change_reason
      )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [requirement_id, changed_by, field_name, old_value, new_value, change_reason]
    );

    return result.rows[0];
  }

  // Get history entry by ID
  static async findById(id: string): Promise<RequirementHistory | null> {
    const result = await db.query(
      'SELECT * FROM requirement_history WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get all history for a requirement
  static async findByRequirementId(requirement_id: string): Promise<RequirementHistoryWithUser[]> {
    const result = await db.query(
      `SELECT rh.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user
       FROM requirement_history rh
       INNER JOIN users u ON rh.changed_by = u.id
       WHERE rh.requirement_id = $1
       ORDER BY rh.created_at DESC`,
      [requirement_id]
    );

    return result.rows;
  }

  // Get history by user
  static async findByUserId(user_id: string, limit?: number): Promise<RequirementHistoryWithUser[]> {
    const limitClause = limit ? `LIMIT ${limit}` : '';

    const result = await db.query(
      `SELECT rh.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user
       FROM requirement_history rh
       INNER JOIN users u ON rh.changed_by = u.id
       WHERE rh.changed_by = $1
       ORDER BY rh.created_at DESC
       ${limitClause}`,
      [user_id]
    );

    return result.rows;
  }

  // Get history for a specific field
  static async findByField(
    requirement_id: string,
    field_name: string
  ): Promise<RequirementHistoryWithUser[]> {
    const result = await db.query(
      `SELECT rh.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user
       FROM requirement_history rh
       INNER JOIN users u ON rh.changed_by = u.id
       WHERE rh.requirement_id = $1 AND rh.field_name = $2
       ORDER BY rh.created_at DESC`,
      [requirement_id, field_name]
    );

    return result.rows;
  }

  // Get recent activity across all requirements in a project
  static async findByProjectId(project_id: string, limit = 50): Promise<RequirementHistoryWithUser[]> {
    const result = await db.query(
      `SELECT rh.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user,
              r.title as requirement_title,
              r.id as requirement_id
       FROM requirement_history rh
       INNER JOIN users u ON rh.changed_by = u.id
       INNER JOIN requirements r ON rh.requirement_id = r.id
       WHERE r.project_id = $1 AND r.is_active = true
       ORDER BY rh.created_at DESC
       LIMIT $2`,
      [project_id, limit]
    );

    return result.rows;
  }

  // Delete old history (for cleanup)
  static async deleteOlderThan(days: number): Promise<number> {
    const result = await db.query(
      `DELETE FROM requirement_history
       WHERE created_at < NOW() - INTERVAL '${days} days'`,
      []
    );

    return result.rowCount ?? 0;
  }

  // Helper functions for common field changes
  static async logStatusChange(
    requirement_id: string,
    changed_by: string,
    old_status: string,
    new_status: string,
    change_reason?: string
  ): Promise<RequirementHistory> {
    return this.logChange(
      requirement_id,
      changed_by,
      'status',
      old_status,
      new_status,
      change_reason
    );
  }

  static async logAssignmentChange(
    requirement_id: string,
    changed_by: string,
    old_assignee?: string,
    new_assignee?: string,
    change_reason?: string
  ): Promise<RequirementHistory> {
    return this.logChange(
      requirement_id,
      changed_by,
      'assignee_id',
      old_assignee || null,
      new_assignee || null,
      change_reason
    );
  }

  static async logPriorityChange(
    requirement_id: string,
    changed_by: string,
    old_priority: number,
    new_priority: number,
    change_reason?: string
  ): Promise<RequirementHistory> {
    return this.logChange(
      requirement_id,
      changed_by,
      'priority',
      old_priority.toString(),
      new_priority.toString(),
      change_reason
    );
  }
}