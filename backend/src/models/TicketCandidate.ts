import { db } from '../config/database';
import { TicketCandidate, CreateTicketCandidateRequest, TicketCandidateWithDetails, User, Requirement } from './types';

export class TicketCandidateModel {
  // Create a new ticket candidate
  static async create(data: CreateTicketCandidateRequest, author_id: string): Promise<TicketCandidate> {
    const result = await db.query(
      `INSERT INTO ticket_candidates (
        title, description, requirement_id, author_id,
        priority, status, order_index, metadata, estimated_effort, labels
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.title,
        data.description,
        data.requirement_id,
        author_id,
        data.priority || 3,
        data.status || 'draft',
        data.order_index || 0,
        data.metadata ? JSON.stringify(data.metadata) : null,
        data.estimated_effort,
        data.labels ? JSON.stringify(data.labels) : null
      ]
    );

    return result.rows[0];
  }

  // Get ticket candidate by ID
  static async findById(id: string): Promise<TicketCandidate | null> {
    const result = await db.query(
      'SELECT * FROM ticket_candidates WHERE id = $1 AND is_active = true',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get ticket candidate by ID with requirement and author details
  static async findByIdWithDetails(id: string): Promise<TicketCandidateWithDetails | null> {
    const result = await db.query(
      `SELECT tc.*,
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
                'updated_at', r.updated_at
              ) as requirement,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'name', u.name,
                'email', u.email,
                'github_username', u.github_username,
                'avatar_url', u.avatar_url
              ) as author
       FROM ticket_candidates tc
       INNER JOIN requirements r ON tc.requirement_id = r.id
       INNER JOIN users u ON tc.author_id = u.id
       WHERE tc.id = $1 AND tc.is_active = true`,
      [id]
    );

    return result.rows[0] || null;
  }

  // Get all ticket candidates for a specific requirement
  static async findByRequirementId(requirement_id: string): Promise<TicketCandidateWithDetails[]> {
    const result = await db.query(
      `SELECT tc.*,
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
                'updated_at', r.updated_at
              ) as requirement,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'name', u.name,
                'email', u.email,
                'github_username', u.github_username,
                'avatar_url', u.avatar_url
              ) as author
       FROM ticket_candidates tc
       INNER JOIN requirements r ON tc.requirement_id = r.id
       INNER JOIN users u ON tc.author_id = u.id
       WHERE tc.requirement_id = $1 AND tc.is_active = true
       ORDER BY tc.order_index ASC, tc.priority ASC, tc.updated_at DESC`,
      [requirement_id]
    );

    return result.rows;
  }

  // Get ticket candidates authored by a user
  static async findByAuthorId(author_id: string): Promise<TicketCandidateWithDetails[]> {
    const result = await db.query(
      `SELECT tc.*,
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
                'updated_at', r.updated_at
              ) as requirement,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'name', u.name,
                'email', u.email,
                'github_username', u.github_username,
                'avatar_url', u.avatar_url
              ) as author
       FROM ticket_candidates tc
       INNER JOIN requirements r ON tc.requirement_id = r.id
       INNER JOIN users u ON tc.author_id = u.id
       WHERE tc.author_id = $1 AND tc.is_active = true
       ORDER BY tc.updated_at DESC`,
      [author_id]
    );

    return result.rows;
  }

  // Get ticket candidates a user has access to (via requirement/project/workspace membership)
  static async findByUserId(user_id: string): Promise<TicketCandidateWithDetails[]> {
    const result = await db.query(
      `SELECT tc.*,
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
                'updated_at', r.updated_at
              ) as requirement,
              JSON_BUILD_OBJECT(
                'id', ta.id,
                'name', ta.name,
                'email', ta.email,
                'github_username', ta.github_username,
                'avatar_url', ta.avatar_url
              ) as author
       FROM ticket_candidates tc
       INNER JOIN requirements r ON tc.requirement_id = r.id
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN workspaces w ON p.workspace_id = w.id
       INNER JOIN workspace_members wm ON w.id = wm.workspace_id
       INNER JOIN users ta ON tc.author_id = ta.id
       WHERE wm.user_id = $1 AND tc.is_active = true
       ORDER BY tc.updated_at DESC`,
      [user_id]
    );

    return result.rows;
  }

  // Update ticket candidate
  static async update(id: string, data: Partial<CreateTicketCandidateRequest>): Promise<TicketCandidate | null> {
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

    if (data.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (data.order_index !== undefined) {
      fields.push(`order_index = $${paramIndex++}`);
      values.push(data.order_index);
    }

    if (data.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`);
      values.push(data.metadata ? JSON.stringify(data.metadata) : null);
    }

    if (data.estimated_effort !== undefined) {
      fields.push(`estimated_effort = $${paramIndex++}`);
      values.push(data.estimated_effort);
    }

    if (data.labels !== undefined) {
      fields.push(`labels = $${paramIndex++}`);
      values.push(data.labels ? JSON.stringify(data.labels) : null);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await db.query(
      `UPDATE ticket_candidates SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex} AND is_active = true
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Update ticket candidate status
  static async updateStatus(id: string, status: 'draft' | 'review' | 'approved' | 'rejected' | 'archived'): Promise<TicketCandidate | null> {
    const result = await db.query(
      `UPDATE ticket_candidates SET status = $1, updated_at = NOW()
       WHERE id = $2 AND is_active = true
       RETURNING *`,
      [status, id]
    );

    return result.rows[0] || null;
  }

  // Update ticket candidate order within a requirement
  static async updateOrderIndex(id: string, order_index: number): Promise<TicketCandidate | null> {
    const result = await db.query(
      `UPDATE ticket_candidates SET order_index = $1, updated_at = NOW()
       WHERE id = $2 AND is_active = true
       RETURNING *`,
      [order_index, id]
    );

    return result.rows[0] || null;
  }

  // Delete ticket candidate (soft delete)
  static async delete(id: string): Promise<boolean> {
    const result = await db.query(
      'UPDATE ticket_candidates SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Hard delete ticket candidate (permanently remove)
  static async hardDelete(id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM ticket_candidates WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user can access ticket candidate (via requirement/project/workspace membership)
  static async canUserAccess(ticket_candidate_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM ticket_candidates tc
       INNER JOIN requirements r ON tc.requirement_id = r.id
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       WHERE tc.id = $1 AND wm.user_id = $2 AND tc.is_active = true`,
      [ticket_candidate_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user is author of ticket candidate
  static async isUserAuthor(ticket_candidate_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      'SELECT 1 FROM ticket_candidates WHERE id = $1 AND author_id = $2 AND is_active = true',
      [ticket_candidate_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }
}