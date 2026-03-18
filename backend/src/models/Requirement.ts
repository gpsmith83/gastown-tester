import { db } from '../config/database';
import { Requirement, CreateRequirementRequest, RequirementWithDetails, User, Project } from './types';

export class RequirementModel {
  // Create a new requirement
  static async create(data: CreateRequirementRequest, author_id: string): Promise<Requirement> {
    const result = await db.query(
      `INSERT INTO requirements (
        title, description, project_id, author_id,
        priority, type, github_issue_number, github_issue_url
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.title,
        data.description,
        data.project_id,
        author_id,
        data.priority || 3,
        data.type || 'feature',
        data.github_issue_number,
        data.github_issue_url
      ]
    );

    return result.rows[0];
  }

  // Get requirement by ID
  static async findById(id: string): Promise<Requirement | null> {
    const result = await db.query(
      'SELECT * FROM requirements WHERE id = $1 AND is_active = true',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get requirement by ID with project and author details
  static async findByIdWithDetails(id: string): Promise<RequirementWithDetails | null> {
    const result = await db.query(
      `SELECT r.*,
              JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name,
                'description', p.description,
                'workspace_id', p.workspace_id,
                'owner_id', p.owner_id,
                'created_at', p.created_at,
                'updated_at', p.updated_at
              ) as project,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as author
       FROM requirements r
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN users u ON r.author_id = u.id
       WHERE r.id = $1 AND r.is_active = true`,
      [id]
    );

    return result.rows[0] || null;
  }

  // Get all requirements in a project
  static async findByProjectId(project_id: string): Promise<RequirementWithDetails[]> {
    const result = await db.query(
      `SELECT r.*,
              JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name,
                'description', p.description,
                'workspace_id', p.workspace_id,
                'owner_id', p.owner_id,
                'created_at', p.created_at,
                'updated_at', p.updated_at
              ) as project,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as author
       FROM requirements r
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN users u ON r.author_id = u.id
       WHERE r.project_id = $1 AND r.is_active = true
       ORDER BY r.priority ASC, r.updated_at DESC`,
      [project_id]
    );

    return result.rows;
  }

  // Get requirements authored by a user
  static async findByAuthorId(author_id: string): Promise<RequirementWithDetails[]> {
    const result = await db.query(
      `SELECT r.*,
              JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name,
                'description', p.description,
                'workspace_id', p.workspace_id,
                'owner_id', p.owner_id,
                'created_at', p.created_at,
                'updated_at', p.updated_at
              ) as project,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as author
       FROM requirements r
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN users u ON r.author_id = u.id
       WHERE r.author_id = $1 AND r.is_active = true
       ORDER BY r.updated_at DESC`,
      [author_id]
    );

    return result.rows;
  }

  // Get requirements a user has access to (via project/workspace membership)
  static async findByUserId(user_id: string): Promise<RequirementWithDetails[]> {
    const result = await db.query(
      `SELECT r.*,
              JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name,
                'description', p.description,
                'workspace_id', p.workspace_id,
                'owner_id', p.owner_id,
                'created_at', p.created_at,
                'updated_at', p.updated_at
              ) as project,
              JSON_BUILD_OBJECT(
                'id', ra.id,
                'username', ra.username,
                'email', ra.email,
                'name', ra.name,
                'avatar_url', ra.avatar_url
              ) as author
       FROM requirements r
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN workspaces w ON p.workspace_id = w.id
       INNER JOIN workspace_members wm ON w.id = wm.workspace_id
       INNER JOIN users ra ON r.author_id = ra.id
       WHERE wm.user_id = $1 AND r.is_active = true
       ORDER BY r.updated_at DESC`,
      [user_id]
    );

    return result.rows;
  }

  // Update requirement
  static async update(id: string, data: Partial<CreateRequirementRequest>): Promise<Requirement | null> {
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

    if (data.priority !== undefined) {
      fields.push(`priority = $${paramIndex++}`);
      values.push(data.priority);
    }

    if (data.type !== undefined) {
      fields.push(`type = $${paramIndex++}`);
      values.push(data.type);
    }

    if (data.github_issue_number !== undefined) {
      fields.push(`github_issue_number = $${paramIndex++}`);
      values.push(data.github_issue_number);
    }

    if (data.github_issue_url !== undefined) {
      fields.push(`github_issue_url = $${paramIndex++}`);
      values.push(data.github_issue_url);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await db.query(
      `UPDATE requirements SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex} AND is_active = true
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Update requirement status
  static async updateStatus(id: string, status: 'draft' | 'active' | 'completed' | 'archived'): Promise<Requirement | null> {
    const result = await db.query(
      `UPDATE requirements SET status = $1, updated_at = NOW()
       WHERE id = $2 AND is_active = true
       RETURNING *`,
      [status, id]
    );

    return result.rows[0] || null;
  }

  // Delete requirement (soft delete)
  static async delete(id: string): Promise<boolean> {
    const result = await db.query(
      'UPDATE requirements SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Hard delete requirement (permanently remove)
  static async hardDelete(id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM requirements WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user can access requirement (via project/workspace membership)
  static async canUserAccess(requirement_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM requirements r
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       WHERE r.id = $1 AND wm.user_id = $2 AND r.is_active = true`,
      [requirement_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user is author of requirement
  static async isUserAuthor(requirement_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      'SELECT 1 FROM requirements WHERE id = $1 AND author_id = $2 AND is_active = true',
      [requirement_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Get multiple requirements by IDs (for export batches)
  static async findByIds(ids: string[]): Promise<Requirement[]> {
    if (ids.length === 0) return [];

    const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
    const result = await db.query(
      `SELECT * FROM requirements
       WHERE id IN (${placeholders}) AND is_active = true
       ORDER BY priority ASC, updated_at DESC`,
      ids
    );

    return result.rows;
  }

  // Get requirements by project with filters (for export batches)
  static async findByProjectIdFiltered(
    project_id: string,
    filters?: {
      status?: 'draft' | 'active' | 'completed' | 'archived';
      is_active?: boolean;
      type?: 'feature' | 'bug' | 'enhancement' | 'epic';
    }
  ): Promise<Requirement[]> {
    let query = `
      SELECT * FROM requirements
      WHERE project_id = $1
    `;
    const values: any[] = [project_id];
    let paramIndex = 2;

    if (filters) {
      if (filters.status) {
        query += ` AND status = $${paramIndex++}`;
        values.push(filters.status);
      }
      if (filters.is_active !== undefined) {
        query += ` AND is_active = $${paramIndex++}`;
        values.push(filters.is_active);
      }
      if (filters.type) {
        query += ` AND type = $${paramIndex++}`;
        values.push(filters.type);
      }
    }

    query += ' ORDER BY priority ASC, updated_at DESC';

    const result = await db.query(query, values);
    return result.rows;
  }
}