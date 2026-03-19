import { db } from '../config/database';
import { Ticket, CreateTicketRequest, TicketWithDetails, User, Project } from './types';

export class TicketModel {
  // Create a new ticket
  static async create(data: CreateTicketRequest, author_id: string): Promise<Ticket> {
    const result = await db.query(
      `INSERT INTO tickets (
        title, description, project_id, assignee_id, author_id,
        priority, type
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.title,
        data.description,
        data.project_id,
        data.assignee_id,
        author_id,
        data.priority || 3,
        data.type || 'task'
      ]
    );

    return result.rows[0];
  }

  // Get ticket by ID
  static async findById(id: string): Promise<Ticket | null> {
    const result = await db.query(
      'SELECT * FROM tickets WHERE id = $1 AND is_active = true',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get ticket by ID with project, author, and assignee details
  static async findByIdWithDetails(id: string): Promise<TicketWithDetails | null> {
    const result = await db.query(
      `SELECT t.*,
              JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name,
                'slug', p.slug,
                'description', p.description,
                'workspace_id', p.workspace_id,
                'github_repo_url', p.github_repo_url,
                'github_repo_id', p.github_repo_id,
                'is_active', p.is_active,
                'created_at', p.created_at,
                'updated_at', p.updated_at
              ) as project,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url,
                'github_id', u.github_id,
                'github_username', u.github_username
              ) as author,
              CASE
                WHEN a.id IS NOT NULL THEN JSON_BUILD_OBJECT(
                  'id', a.id,
                  'email', a.email,
                  'name', a.name,
                  'avatar_url', a.avatar_url,
                  'github_id', a.github_id,
                  'github_username', a.github_username
                )
                ELSE NULL
              END as assignee
       FROM tickets t
       INNER JOIN projects p ON t.project_id = p.id
       INNER JOIN users u ON t.author_id = u.id
       LEFT JOIN users a ON t.assignee_id = a.id
       WHERE t.id = $1 AND t.is_active = true`,
      [id]
    );

    return result.rows[0] || null;
  }

  // Get all tickets in a project
  static async findByProjectId(project_id: string): Promise<TicketWithDetails[]> {
    const result = await db.query(
      `SELECT t.*,
              JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name,
                'slug', p.slug,
                'description', p.description,
                'workspace_id', p.workspace_id,
                'github_repo_url', p.github_repo_url,
                'github_repo_id', p.github_repo_id,
                'is_active', p.is_active,
                'created_at', p.created_at,
                'updated_at', p.updated_at
              ) as project,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url,
                'github_id', u.github_id,
                'github_username', u.github_username
              ) as author,
              CASE
                WHEN a.id IS NOT NULL THEN JSON_BUILD_OBJECT(
                  'id', a.id,
                  'email', a.email,
                  'name', a.name,
                  'avatar_url', a.avatar_url,
                  'github_id', a.github_id,
                  'github_username', a.github_username
                )
                ELSE NULL
              END as assignee
       FROM tickets t
       INNER JOIN projects p ON t.project_id = p.id
       INNER JOIN users u ON t.author_id = u.id
       LEFT JOIN users a ON t.assignee_id = a.id
       WHERE t.project_id = $1 AND t.is_active = true
       ORDER BY t.priority ASC, t.updated_at DESC`,
      [project_id]
    );

    return result.rows;
  }

  // Get tickets authored by a user
  static async findByAuthorId(author_id: string): Promise<TicketWithDetails[]> {
    const result = await db.query(
      `SELECT t.*,
              JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name,
                'slug', p.slug,
                'description', p.description,
                'workspace_id', p.workspace_id,
                'github_repo_url', p.github_repo_url,
                'github_repo_id', p.github_repo_id,
                'is_active', p.is_active,
                'created_at', p.created_at,
                'updated_at', p.updated_at
              ) as project,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url,
                'github_id', u.github_id,
                'github_username', u.github_username
              ) as author,
              CASE
                WHEN a.id IS NOT NULL THEN JSON_BUILD_OBJECT(
                  'id', a.id,
                  'email', a.email,
                  'name', a.name,
                  'avatar_url', a.avatar_url,
                  'github_id', a.github_id,
                  'github_username', a.github_username
                )
                ELSE NULL
              END as assignee
       FROM tickets t
       INNER JOIN projects p ON t.project_id = p.id
       INNER JOIN users u ON t.author_id = u.id
       LEFT JOIN users a ON t.assignee_id = a.id
       WHERE t.author_id = $1 AND t.is_active = true
       ORDER BY t.updated_at DESC`,
      [author_id]
    );

    return result.rows;
  }

  // Get tickets assigned to a user
  static async findByAssigneeId(assignee_id: string): Promise<TicketWithDetails[]> {
    const result = await db.query(
      `SELECT t.*,
              JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name,
                'slug', p.slug,
                'description', p.description,
                'workspace_id', p.workspace_id,
                'github_repo_url', p.github_repo_url,
                'github_repo_id', p.github_repo_id,
                'is_active', p.is_active,
                'created_at', p.created_at,
                'updated_at', p.updated_at
              ) as project,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url,
                'github_id', u.github_id,
                'github_username', u.github_username
              ) as author,
              CASE
                WHEN a.id IS NOT NULL THEN JSON_BUILD_OBJECT(
                  'id', a.id,
                  'email', a.email,
                  'name', a.name,
                  'avatar_url', a.avatar_url,
                  'github_id', a.github_id,
                  'github_username', a.github_username
                )
                ELSE NULL
              END as assignee
       FROM tickets t
       INNER JOIN projects p ON t.project_id = p.id
       INNER JOIN users u ON t.author_id = u.id
       LEFT JOIN users a ON t.assignee_id = a.id
       WHERE t.assignee_id = $1 AND t.is_active = true
       ORDER BY t.priority ASC, t.updated_at DESC`,
      [assignee_id]
    );

    return result.rows;
  }

  // Get tickets a user has access to (via project/workspace membership)
  static async findByUserId(user_id: string): Promise<TicketWithDetails[]> {
    const result = await db.query(
      `SELECT t.*,
              JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name,
                'slug', p.slug,
                'description', p.description,
                'workspace_id', p.workspace_id,
                'github_repo_url', p.github_repo_url,
                'github_repo_id', p.github_repo_id,
                'is_active', p.is_active,
                'created_at', p.created_at,
                'updated_at', p.updated_at
              ) as project,
              JSON_BUILD_OBJECT(
                'id', ta.id,
                'email', ta.email,
                'name', ta.name,
                'avatar_url', ta.avatar_url,
                'github_id', ta.github_id,
                'github_username', ta.github_username
              ) as author,
              CASE
                WHEN a.id IS NOT NULL THEN JSON_BUILD_OBJECT(
                  'id', a.id,
                  'email', a.email,
                  'name', a.name,
                  'avatar_url', a.avatar_url,
                  'github_id', a.github_id,
                  'github_username', a.github_username
                )
                ELSE NULL
              END as assignee
       FROM tickets t
       INNER JOIN projects p ON t.project_id = p.id
       INNER JOIN workspaces w ON p.workspace_id = w.id
       INNER JOIN workspace_members wm ON w.id = wm.workspace_id
       INNER JOIN users ta ON t.author_id = ta.id
       LEFT JOIN users a ON t.assignee_id = a.id
       WHERE wm.user_id = $1 AND t.is_active = true
       ORDER BY t.updated_at DESC`,
      [user_id]
    );

    return result.rows;
  }

  // Update ticket
  static async update(id: string, data: Partial<CreateTicketRequest>): Promise<Ticket | null> {
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

    if (data.assignee_id !== undefined) {
      fields.push(`assignee_id = $${paramIndex++}`);
      values.push(data.assignee_id);
    }

    if (data.priority !== undefined) {
      fields.push(`priority = $${paramIndex++}`);
      values.push(data.priority);
    }

    if (data.type !== undefined) {
      fields.push(`type = $${paramIndex++}`);
      values.push(data.type);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await db.query(
      `UPDATE tickets SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex} AND is_active = true
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Update ticket status
  static async updateStatus(id: string, status: 'open' | 'in_progress' | 'completed' | 'closed' | 'cancelled'): Promise<Ticket | null> {
    const result = await db.query(
      `UPDATE tickets SET status = $1, updated_at = NOW()
       WHERE id = $2 AND is_active = true
       RETURNING *`,
      [status, id]
    );

    return result.rows[0] || null;
  }

  // Assign ticket to user
  static async assign(id: string, assignee_id: string | null): Promise<Ticket | null> {
    const result = await db.query(
      `UPDATE tickets SET assignee_id = $1, updated_at = NOW()
       WHERE id = $2 AND is_active = true
       RETURNING *`,
      [assignee_id, id]
    );

    return result.rows[0] || null;
  }

  // Delete ticket (soft delete)
  static async delete(id: string): Promise<boolean> {
    const result = await db.query(
      'UPDATE tickets SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Hard delete ticket (permanently remove)
  static async hardDelete(id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM tickets WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user can access ticket (via project/workspace membership)
  static async canUserAccess(ticket_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM tickets t
       INNER JOIN projects p ON t.project_id = p.id
       INNER JOIN workspaces w ON p.workspace_id = w.id
       INNER JOIN workspace_members wm ON w.id = wm.workspace_id
       WHERE t.id = $1 AND wm.user_id = $2 AND t.is_active = true`,
      [ticket_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user is author of ticket
  static async isUserAuthor(ticket_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      'SELECT 1 FROM tickets WHERE id = $1 AND author_id = $2 AND is_active = true',
      [ticket_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user is assignee of ticket
  static async isUserAssignee(ticket_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      'SELECT 1 FROM tickets WHERE id = $1 AND assignee_id = $2 AND is_active = true',
      [ticket_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }
}