import { db } from '../config/database';
import {
  RequirementComment,
  RequirementCommentWithAuthor,
  CreateRequirementCommentRequest
} from './types';

export class RequirementCommentModel {
  // Create a new comment
  static async create(
    requirement_id: string,
    author_id: string,
    data: CreateRequirementCommentRequest
  ): Promise<RequirementComment> {
    const result = await db.query(
      `INSERT INTO requirement_comments (
        requirement_id, author_id, content, comment_type, is_internal, metadata
      )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        requirement_id,
        author_id,
        data.content,
        data.comment_type || 'comment',
        data.is_internal || false,
        data.metadata || {}
      ]
    );

    return result.rows[0];
  }

  // Get comment by ID
  static async findById(id: string): Promise<RequirementComment | null> {
    const result = await db.query(
      'SELECT * FROM requirement_comments WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get comment by ID with author details
  static async findByIdWithAuthor(id: string): Promise<RequirementCommentWithAuthor | null> {
    const result = await db.query(
      `SELECT rc.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as author
       FROM requirement_comments rc
       INNER JOIN users u ON rc.author_id = u.id
       WHERE rc.id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  // Get all comments for a requirement
  static async findByRequirementId(requirement_id: string): Promise<RequirementCommentWithAuthor[]> {
    const result = await db.query(
      `SELECT rc.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as author
       FROM requirement_comments rc
       INNER JOIN users u ON rc.author_id = u.id
       WHERE rc.requirement_id = $1
       ORDER BY rc.created_at ASC`,
      [requirement_id]
    );

    return result.rows;
  }

  // Get comments by author
  static async findByAuthorId(author_id: string): Promise<RequirementCommentWithAuthor[]> {
    const result = await db.query(
      `SELECT rc.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as author
       FROM requirement_comments rc
       INNER JOIN users u ON rc.author_id = u.id
       WHERE rc.author_id = $1
       ORDER BY rc.created_at DESC`,
      [author_id]
    );

    return result.rows;
  }

  // Update comment content
  static async update(id: string, content: string): Promise<RequirementComment | null> {
    const result = await db.query(
      `UPDATE requirement_comments
       SET content = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [content, id]
    );

    return result.rows[0] || null;
  }

  // Delete comment
  static async delete(id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM requirement_comments WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user can access comment (via requirement access)
  static async canUserAccess(comment_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM requirement_comments rc
       INNER JOIN requirements r ON rc.requirement_id = r.id
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       WHERE rc.id = $1 AND wm.user_id = $2 AND r.is_active = true`,
      [comment_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user is author of comment
  static async isUserAuthor(comment_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      'SELECT 1 FROM requirement_comments WHERE id = $1 AND author_id = $2',
      [comment_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Create system comment for status/assignment changes
  static async createSystemComment(
    requirement_id: string,
    changed_by: string,
    comment_type: 'status_change' | 'assignment_change' | 'priority_change',
    content: string,
    metadata?: any
  ): Promise<RequirementComment> {
    return this.create(requirement_id, changed_by, {
      content,
      comment_type,
      is_internal: false,
      metadata: metadata || {}
    });
  }
}