import { db } from '../config/database';
import {
  PersonaOrchestrationRule,
  CreateOrchestrationRuleRequest,
  UpdateOrchestrationRuleRequest,
  PersonaProgressionConfig,
  CreateProgressionConfigRequest,
  PersonaOrchestrationExecution,
  TriggerOrchestrationRequest
} from './types';

export class PersonaOrchestrationModel {
  // Create a new orchestration rule
  static async createRule(data: CreateOrchestrationRuleRequest): Promise<PersonaOrchestrationRule> {
    const result = await db.query(
      `INSERT INTO persona_orchestration_rules (
        rule_name, rule_type, description, conditions, actions, priority
      )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.rule_name,
        data.rule_type,
        data.description,
        JSON.stringify(data.conditions),
        JSON.stringify(data.actions),
        data.priority || 3
      ]
    );

    return result.rows[0];
  }

  // Get orchestration rule by ID
  static async findRuleById(id: string): Promise<PersonaOrchestrationRule | null> {
    const result = await db.query(
      'SELECT * FROM persona_orchestration_rules WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get all active orchestration rules
  static async findActiveRules(rule_type?: string): Promise<PersonaOrchestrationRule[]> {
    let query = 'SELECT * FROM persona_orchestration_rules WHERE is_active = true';
    const values: any[] = [];

    if (rule_type) {
      query += ' AND rule_type = $1';
      values.push(rule_type);
    }

    query += ' ORDER BY priority ASC, created_at ASC';

    const result = await db.query(query, values);
    return result.rows;
  }

  // Update orchestration rule
  static async updateRule(id: string, data: UpdateOrchestrationRuleRequest): Promise<PersonaOrchestrationRule | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.rule_name !== undefined) {
      fields.push(`rule_name = $${paramIndex++}`);
      values.push(data.rule_name);
    }

    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }

    if (data.conditions !== undefined) {
      fields.push(`conditions = $${paramIndex++}`);
      values.push(JSON.stringify(data.conditions));
    }

    if (data.actions !== undefined) {
      fields.push(`actions = $${paramIndex++}`);
      values.push(JSON.stringify(data.actions));
    }

    if (data.priority !== undefined) {
      fields.push(`priority = $${paramIndex++}`);
      values.push(data.priority);
    }

    if (data.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }

    if (fields.length === 0) {
      return this.findRuleById(id);
    }

    values.push(id);

    const result = await db.query(
      `UPDATE persona_orchestration_rules SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Delete orchestration rule
  static async deleteRule(id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM persona_orchestration_rules WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Create progression configuration
  static async createProgression(data: CreateProgressionConfigRequest): Promise<PersonaProgressionConfig> {
    const result = await db.query(
      `INSERT INTO persona_progression_configs (
        progression_name, description, default_sequence, is_default
      )
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        data.progression_name,
        data.description,
        data.default_sequence,
        data.is_default || false
      ]
    );

    return result.rows[0];
  }

  // Get progression configuration by ID
  static async findProgressionById(id: string): Promise<PersonaProgressionConfig | null> {
    const result = await db.query(
      'SELECT * FROM persona_progression_configs WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get default progression configuration
  static async findDefaultProgression(): Promise<PersonaProgressionConfig | null> {
    const result = await db.query(
      'SELECT * FROM persona_progression_configs WHERE is_default = true ORDER BY created_at ASC LIMIT 1'
    );

    return result.rows[0] || null;
  }

  // Get all progression configurations
  static async findAllProgressions(): Promise<PersonaProgressionConfig[]> {
    const result = await db.query(
      'SELECT * FROM persona_progression_configs ORDER BY is_default DESC, created_at ASC'
    );

    return result.rows;
  }

  // Log orchestration execution
  static async logExecution(data: {
    rule_id: string;
    requirement_id?: string;
    session_id?: string;
    user_id?: string;
    trigger_event: string;
    trigger_data?: any;
  }): Promise<PersonaOrchestrationExecution> {
    const result = await db.query(
      `INSERT INTO persona_orchestration_executions (
        rule_id, requirement_id, session_id, user_id, trigger_event, trigger_data
      )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.rule_id,
        data.requirement_id,
        data.session_id,
        data.user_id,
        data.trigger_event,
        data.trigger_data ? JSON.stringify(data.trigger_data) : null
      ]
    );

    return result.rows[0];
  }

  // Update execution status
  static async updateExecutionStatus(
    execution_id: string,
    status: 'pending' | 'executing' | 'completed' | 'failed',
    actions_executed?: any[],
    error_message?: string
  ): Promise<PersonaOrchestrationExecution | null> {
    const result = await db.query(
      `UPDATE persona_orchestration_executions
       SET execution_status = $1,
           actions_executed = $2,
           completed_at = CASE WHEN $1 IN ('completed', 'failed') THEN NOW() ELSE completed_at END,
           error_message = $3
       WHERE id = $4
       RETURNING *`,
      [
        status,
        actions_executed ? JSON.stringify(actions_executed) : null,
        error_message,
        execution_id
      ]
    );

    return result.rows[0] || null;
  }

  // Get execution history for a requirement
  static async findExecutionsByRequirement(requirement_id: string): Promise<PersonaOrchestrationExecution[]> {
    const result = await db.query(
      `SELECT * FROM persona_orchestration_executions
       WHERE requirement_id = $1
       ORDER BY started_at DESC`,
      [requirement_id]
    );

    return result.rows;
  }

  // Get execution history for a session
  static async findExecutionsBySession(session_id: string): Promise<PersonaOrchestrationExecution[]> {
    const result = await db.query(
      `SELECT * FROM persona_orchestration_executions
       WHERE session_id = $1
       ORDER BY started_at DESC`,
      [session_id]
    );

    return result.rows;
  }

  // Get recent executions with details
  static async findRecentExecutions(limit: number = 20): Promise<any[]> {
    const result = await db.query(
      `SELECT e.*,
              r.rule_name,
              r.rule_type,
              req.title as requirement_title,
              rs.session_name,
              u.username
       FROM persona_orchestration_executions e
       INNER JOIN persona_orchestration_rules r ON e.rule_id = r.id
       LEFT JOIN requirements req ON e.requirement_id = req.id
       LEFT JOIN refinement_sessions rs ON e.session_id = rs.id
       LEFT JOIN users u ON e.user_id = u.id
       ORDER BY e.started_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  // Get orchestration statistics
  static async getOrchestrationStats(): Promise<{
    total_rules: number;
    active_rules: number;
    total_executions: number;
    recent_executions: number;
    success_rate: number;
    rules_by_type: { rule_type: string; count: number }[];
  }> {
    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE r.id IS NOT NULL) as total_rules,
        COUNT(*) FILTER (WHERE r.is_active = true) as active_rules,
        COUNT(*) FILTER (WHERE e.id IS NOT NULL) as total_executions,
        COUNT(*) FILTER (WHERE e.started_at > NOW() - INTERVAL '24 hours') as recent_executions,
        COALESCE(
          COUNT(*) FILTER (WHERE e.execution_status = 'completed') * 100.0 /
          NULLIF(COUNT(*) FILTER (WHERE e.execution_status IN ('completed', 'failed')), 0),
          0
        ) as success_rate
      FROM persona_orchestration_rules r
      LEFT JOIN persona_orchestration_executions e ON r.id = e.rule_id
    `);

    const typeResult = await db.query(`
      SELECT rule_type, COUNT(*) as count
      FROM persona_orchestration_rules
      WHERE is_active = true
      GROUP BY rule_type
      ORDER BY count DESC
    `);

    const stats = result.rows[0];
    return {
      total_rules: parseInt(stats.total_rules || '0'),
      active_rules: parseInt(stats.active_rules || '0'),
      total_executions: parseInt(stats.total_executions || '0'),
      recent_executions: parseInt(stats.recent_executions || '0'),
      success_rate: parseFloat(stats.success_rate || '0'),
      rules_by_type: typeResult.rows.map(row => ({
        rule_type: row.rule_type,
        count: parseInt(row.count)
      }))
    };
  }
}