import { db } from '../config/database';
import {
  PersonaProgressionHistory,
  CreatePersonaProgressionRequest,
  UpdatePersonaProgressionRequest,
  PersonaProgressionSession,
  PersonaProgressionAnalytics
} from './types';

export class PersonaProgressionService {
  // Create a new persona progression record
  static async create(data: CreatePersonaProgressionRequest, user_id: string): Promise<PersonaProgressionHistory> {
    const result = await db.query(
      `INSERT INTO persona_progression_history (
        project_id, user_id, session_id, session_type,
        specialist_selected, specialist_reason, previous_specialists,
        refinement_stage, refinement_outcome, outcome_data,
        current_persona_stack, progression_context,
        progression_score, time_spent_minutes, user_satisfaction
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        data.project_id,
        user_id,
        data.session_id,
        data.session_type || 'refinement',
        data.specialist_selected,
        data.specialist_reason,
        JSON.stringify(data.previous_specialists || []),
        data.refinement_stage,
        data.refinement_outcome,
        JSON.stringify(data.outcome_data || {}),
        JSON.stringify(data.current_persona_stack),
        JSON.stringify(data.progression_context || {}),
        data.progression_score,
        data.time_spent_minutes,
        data.user_satisfaction
      ]
    );

    return result.rows[0];
  }

  // Get progression record by ID
  static async findById(id: string): Promise<PersonaProgressionHistory | null> {
    const result = await db.query(
      'SELECT * FROM persona_progression_history WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get all progression records for a session
  static async findBySessionId(session_id: string): Promise<PersonaProgressionHistory[]> {
    const result = await db.query(
      `SELECT * FROM persona_progression_history
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [session_id]
    );

    return result.rows;
  }

  // Get progression records for a project
  static async findByProjectId(project_id: string): Promise<PersonaProgressionHistory[]> {
    const result = await db.query(
      `SELECT * FROM persona_progression_history
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [project_id]
    );

    return result.rows;
  }

  // Get progression records for a user in a project
  static async findByUserAndProject(user_id: string, project_id: string): Promise<PersonaProgressionHistory[]> {
    const result = await db.query(
      `SELECT * FROM persona_progression_history
       WHERE user_id = $1 AND project_id = $2
       ORDER BY created_at DESC`,
      [user_id, project_id]
    );

    return result.rows;
  }

  // Update progression record
  static async update(id: string, data: UpdatePersonaProgressionRequest): Promise<PersonaProgressionHistory | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.specialist_selected !== undefined) {
      fields.push(`specialist_selected = $${paramIndex++}`);
      values.push(data.specialist_selected);
    }

    if (data.specialist_reason !== undefined) {
      fields.push(`specialist_reason = $${paramIndex++}`);
      values.push(data.specialist_reason);
    }

    if (data.previous_specialists !== undefined) {
      fields.push(`previous_specialists = $${paramIndex++}`);
      values.push(JSON.stringify(data.previous_specialists));
    }

    if (data.refinement_stage !== undefined) {
      fields.push(`refinement_stage = $${paramIndex++}`);
      values.push(data.refinement_stage);
    }

    if (data.refinement_outcome !== undefined) {
      fields.push(`refinement_outcome = $${paramIndex++}`);
      values.push(data.refinement_outcome);
    }

    if (data.outcome_data !== undefined) {
      fields.push(`outcome_data = $${paramIndex++}`);
      values.push(JSON.stringify(data.outcome_data));
    }

    if (data.current_persona_stack !== undefined) {
      fields.push(`current_persona_stack = $${paramIndex++}`);
      values.push(JSON.stringify(data.current_persona_stack));
    }

    if (data.progression_context !== undefined) {
      fields.push(`progression_context = $${paramIndex++}`);
      values.push(JSON.stringify(data.progression_context));
    }

    if (data.progression_score !== undefined) {
      fields.push(`progression_score = $${paramIndex++}`);
      values.push(data.progression_score);
    }

    if (data.time_spent_minutes !== undefined) {
      fields.push(`time_spent_minutes = $${paramIndex++}`);
      values.push(data.time_spent_minutes);
    }

    if (data.user_satisfaction !== undefined) {
      fields.push(`user_satisfaction = $${paramIndex++}`);
      values.push(data.user_satisfaction);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await db.query(
      `UPDATE persona_progression_history SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Get current session state for a user in a project
  static async getCurrentSession(user_id: string, project_id: string, session_id?: string): Promise<PersonaProgressionSession | null> {
    let whereClause = 'WHERE user_id = $1 AND project_id = $2';
    const params = [user_id, project_id];

    if (session_id) {
      whereClause += ' AND session_id = $3';
      params.push(session_id);
    } else {
      // Get the most recent session if no session_id specified
      whereClause += ` AND session_id = (
        SELECT session_id FROM persona_progression_history
        WHERE user_id = $1 AND project_id = $2
        ORDER BY created_at DESC LIMIT 1
      )`;
    }

    const result = await db.query(
      `SELECT session_id, project_id, user_id, session_type,
              COUNT(*) as total_steps,
              AVG(progression_score) as average_score,
              SUM(time_spent_minutes) as total_time_minutes,
              MIN(created_at) as started_at,
              MAX(updated_at) as last_activity
       FROM persona_progression_history
       ${whereClause}
       GROUP BY session_id, project_id, user_id, session_type`,
      params
    );

    if (result.rows.length === 0) return null;

    const sessionData = result.rows[0];
    const history = await this.findBySessionId(sessionData.session_id);

    // Count completed steps
    const completedSteps = history.filter(h => h.refinement_outcome === 'completed').length;

    // Get current specialist from latest record
    const latestRecord = history[history.length - 1];

    return {
      session_id: sessionData.session_id,
      project_id: sessionData.project_id,
      user_id: sessionData.user_id,
      session_type: sessionData.session_type,
      history,
      current_specialist: latestRecord?.specialist_selected,
      progression_stats: {
        total_steps: parseInt(sessionData.total_steps),
        completed_steps: completedSteps,
        average_score: sessionData.average_score ? parseFloat(sessionData.average_score) : undefined,
        total_time_minutes: parseInt(sessionData.total_time_minutes || '0')
      },
      started_at: sessionData.started_at,
      last_activity: sessionData.last_activity
    };
  }

  // Get specialist selection history for a project
  static async getSpecialistHistory(project_id: string, limit = 50): Promise<Array<{
    specialist: string;
    selected_count: number;
    success_rate: number;
    average_score: number;
  }>> {
    const result = await db.query(
      `SELECT specialist_selected as specialist,
              COUNT(*) as selected_count,
              ROUND(AVG(CASE WHEN refinement_outcome = 'completed' THEN 100.0 ELSE 0.0 END), 2) as success_rate,
              ROUND(AVG(progression_score), 2) as average_score
       FROM persona_progression_history
       WHERE project_id = $1 AND specialist_selected IS NOT NULL
       GROUP BY specialist_selected
       ORDER BY selected_count DESC, average_score DESC NULLS LAST
       LIMIT $2`,
      [project_id, limit]
    );

    return result.rows.map(row => ({
      specialist: row.specialist,
      selected_count: parseInt(row.selected_count),
      success_rate: parseFloat(row.success_rate || '0'),
      average_score: parseFloat(row.average_score || '0')
    }));
  }

  // Get refinement stage analytics
  static async getStageAnalytics(project_id: string): Promise<Array<{
    stage: string;
    completion_rate: number;
    average_score: number;
    average_duration_minutes: number;
  }>> {
    const result = await db.query(
      `SELECT refinement_stage as stage,
              ROUND(AVG(CASE WHEN refinement_outcome = 'completed' THEN 100.0 ELSE 0.0 END), 2) as completion_rate,
              ROUND(AVG(progression_score), 2) as average_score,
              ROUND(AVG(time_spent_minutes), 2) as average_duration_minutes
       FROM persona_progression_history
       WHERE project_id = $1 AND refinement_stage IS NOT NULL
       GROUP BY refinement_stage
       ORDER BY completion_rate DESC, average_score DESC NULLS LAST`,
      [project_id]
    );

    return result.rows.map(row => ({
      stage: row.stage,
      completion_rate: parseFloat(row.completion_rate || '0'),
      average_score: parseFloat(row.average_score || '0'),
      average_duration_minutes: parseFloat(row.average_duration_minutes || '0')
    }));
  }

  // Get comprehensive analytics for a project
  static async getProjectAnalytics(project_id: string): Promise<PersonaProgressionAnalytics> {
    // Get overall session stats
    const sessionStatsResult = await db.query(
      `SELECT COUNT(DISTINCT session_id) as total_sessions,
              ROUND(AVG(CASE WHEN refinement_outcome = 'completed' THEN 100.0 ELSE 0.0 END), 2) as completion_rate,
              ROUND(AVG(time_spent_minutes), 2) as average_session_duration
       FROM persona_progression_history
       WHERE project_id = $1`,
      [project_id]
    );

    const sessionStats = sessionStatsResult.rows[0];
    const specialistHistory = await this.getSpecialistHistory(project_id);
    const stageAnalytics = await this.getStageAnalytics(project_id);

    return {
      project_id,
      total_sessions: parseInt(sessionStats.total_sessions || '0'),
      completion_rate: parseFloat(sessionStats.completion_rate || '0'),
      average_session_duration: parseFloat(sessionStats.average_session_duration || '0'),
      most_used_specialists: specialistHistory.map(sh => ({
        specialist: sh.specialist,
        usage_count: sh.selected_count,
        success_rate: sh.success_rate
      })),
      progression_trends: stageAnalytics.map(sa => ({
        stage: sa.stage,
        average_score: sa.average_score,
        completion_rate: sa.completion_rate
      }))
    };
  }

  // Delete progression records (for cleanup or privacy)
  static async deleteBySessionId(session_id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM persona_progression_history WHERE session_id = $1',
      [session_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user can access progression data (via project access)
  static async canUserAccess(progression_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM persona_progression_history pph
       INNER JOIN projects p ON pph.project_id = p.id
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       WHERE pph.id = $1 AND wm.user_id = $2`,
      [progression_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Helper method to generate a unique session ID
  static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}