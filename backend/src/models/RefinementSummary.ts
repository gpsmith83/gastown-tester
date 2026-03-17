import { db } from '../config/database';
import {
  RefinementSummary,
  RefinementSummaryWithDetails,
  CreateRefinementSummaryRequest
} from './types';

export class RefinementSummaryModel {
  // Create a new refinement summary
  static async create(data: CreateRefinementSummaryRequest): Promise<RefinementSummary> {
    const result = await db.query(
      `INSERT INTO refinement_summaries (
        requirement_id, session_id, title, summary, key_points,
        clarifications_made, outstanding_questions, message_count,
        confidence_score, summary_type, generated_by, ai_model,
        ai_tokens_used, generation_metadata
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        data.requirement_id,
        data.session_id,
        data.title,
        data.summary,
        data.key_points,
        data.clarifications_made,
        data.outstanding_questions,
        data.message_count,
        data.confidence_score,
        data.summary_type || 'conversation_progress',
        data.generated_by || 'ai',
        data.ai_model,
        data.ai_tokens_used,
        data.generation_metadata ? JSON.stringify(data.generation_metadata) : null
      ]
    );

    return result.rows[0];
  }

  // Get summary by ID
  static async findById(id: string): Promise<RefinementSummary | null> {
    const result = await db.query(
      'SELECT * FROM refinement_summaries WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get summary by ID with requirement and session details
  static async findByIdWithDetails(id: string): Promise<RefinementSummaryWithDetails | null> {
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
                'id', rs.id,
                'requirement_id', rs.requirement_id,
                'user_id', rs.user_id,
                'title', rs.title,
                'description', rs.description,
                'status', rs.status,
                'started_at', rs.started_at,
                'completed_at', rs.completed_at,
                'created_at', rs.created_at,
                'updated_at', rs.updated_at
              ) as session
       FROM refinement_summaries s
       INNER JOIN requirements r ON s.requirement_id = r.id
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN users ra ON r.author_id = ra.id
       INNER JOIN refinement_sessions rs ON s.session_id = rs.id
       WHERE s.id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  // Get summaries for a specific session, ordered by message_count
  static async findBySessionId(session_id: string): Promise<RefinementSummary[]> {
    const result = await db.query(
      `SELECT * FROM refinement_summaries
       WHERE session_id = $1
       ORDER BY message_count ASC, created_at ASC`,
      [session_id]
    );

    return result.rows;
  }

  // Get summaries for a specific requirement across all sessions
  static async findByRequirementId(requirement_id: string): Promise<RefinementSummary[]> {
    const result = await db.query(
      `SELECT * FROM refinement_summaries
       WHERE requirement_id = $1
       ORDER BY created_at DESC`,
      [requirement_id]
    );

    return result.rows;
  }

  // Get the latest summary for a session
  static async findLatestBySessionId(session_id: string): Promise<RefinementSummary | null> {
    const result = await db.query(
      `SELECT * FROM refinement_summaries
       WHERE session_id = $1
       ORDER BY message_count DESC, created_at DESC
       LIMIT 1`,
      [session_id]
    );

    return result.rows[0] || null;
  }

  // Get the latest summary for a requirement (across all sessions)
  static async findLatestByRequirementId(requirement_id: string): Promise<RefinementSummary | null> {
    const result = await db.query(
      `SELECT * FROM refinement_summaries
       WHERE requirement_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [requirement_id]
    );

    return result.rows[0] || null;
  }

  // Update an existing summary
  static async update(id: string, data: Partial<CreateRefinementSummaryRequest>): Promise<RefinementSummary | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }

    if (data.summary !== undefined) {
      fields.push(`summary = $${paramIndex++}`);
      values.push(data.summary);
    }

    if (data.key_points !== undefined) {
      fields.push(`key_points = $${paramIndex++}`);
      values.push(data.key_points);
    }

    if (data.clarifications_made !== undefined) {
      fields.push(`clarifications_made = $${paramIndex++}`);
      values.push(data.clarifications_made);
    }

    if (data.outstanding_questions !== undefined) {
      fields.push(`outstanding_questions = $${paramIndex++}`);
      values.push(data.outstanding_questions);
    }

    if (data.confidence_score !== undefined) {
      fields.push(`confidence_score = $${paramIndex++}`);
      values.push(data.confidence_score);
    }

    if (data.summary_type !== undefined) {
      fields.push(`summary_type = $${paramIndex++}`);
      values.push(data.summary_type);
    }

    if (data.generation_metadata !== undefined) {
      fields.push(`generation_metadata = $${paramIndex++}`);
      values.push(data.generation_metadata ? JSON.stringify(data.generation_metadata) : null);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    // Increment version
    fields.push(`version = version + 1`);

    values.push(id);

    const result = await db.query(
      `UPDATE refinement_summaries SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Delete summary
  static async delete(id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM refinement_summaries WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user can access summary (via requirement access)
  static async canUserAccess(summary_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM refinement_summaries s
       INNER JOIN requirements r ON s.requirement_id = r.id AND r.is_active = true
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       WHERE s.id = $1 AND wm.user_id = $2`,
      [summary_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Get summary count for a session
  static async getSummaryCount(session_id: string): Promise<number> {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM refinement_summaries WHERE session_id = $1',
      [session_id]
    );

    return parseInt(result.rows[0].count);
  }

  // Check if a summary should be generated based on message count and existing summaries
  static async shouldGenerateSummary(session_id: string, current_message_count: number): Promise<boolean> {
    // Generate summary every 4 messages, or if no summary exists yet
    const latestSummary = await this.findLatestBySessionId(session_id);

    if (!latestSummary) {
      // Generate first summary after 2 messages (user + AI response)
      return current_message_count >= 2;
    }

    // Generate new summary if we have 4 or more new messages since last summary
    return current_message_count >= latestSummary.message_count + 4;
  }
}