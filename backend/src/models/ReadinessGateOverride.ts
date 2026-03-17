import { db } from '../config/database';
import {
  ReadinessGateOverride,
  ReadinessGateOverrideWithDetails,
  CreateReadinessGateOverrideRequest
} from './types';

export class ReadinessGateOverrideModel {
  // Create a new readiness gate override
  static async create(data: CreateReadinessGateOverrideRequest, overridden_by: string): Promise<ReadinessGateOverride> {
    // First, deactivate any existing active overrides for this requirement
    await db.query(
      'UPDATE readiness_gate_overrides SET is_active = false WHERE requirement_id = $1 AND is_active = true',
      [data.requirement_id]
    );

    const result = await db.query(
      `INSERT INTO readiness_gate_overrides (
        requirement_id, override_type, override_reason, overridden_by,
        gate_check_result, readiness_score_at_override, blocking_dimensions,
        valid_until, conditions
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.requirement_id,
        data.override_type,
        data.override_reason,
        overridden_by,
        data.gate_check_result ? JSON.stringify(data.gate_check_result) : null,
        data.readiness_score_at_override || 0,
        data.blocking_dimensions,
        data.valid_until,
        data.conditions
      ]
    );

    return result.rows[0];
  }

  // Get override by ID
  static async findById(id: string): Promise<ReadinessGateOverride | null> {
    const result = await db.query(
      'SELECT * FROM readiness_gate_overrides WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get override by ID with full details
  static async findByIdWithDetails(id: string): Promise<ReadinessGateOverrideWithDetails | null> {
    const result = await db.query(
      `SELECT o.*,
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
              CASE
                WHEN o.overridden_by IS NOT NULL THEN
                  JSON_BUILD_OBJECT(
                    'id', uo.id,
                    'username', uo.username,
                    'email', uo.email,
                    'name', uo.name,
                    'avatar_url', uo.avatar_url
                  )
                ELSE NULL
              END as overridden_by_user,
              CASE
                WHEN o.approved_by IS NOT NULL THEN
                  JSON_BUILD_OBJECT(
                    'id', ua.id,
                    'username', ua.username,
                    'email', ua.email,
                    'name', ua.name,
                    'avatar_url', ua.avatar_url
                  )
                ELSE NULL
              END as approved_by_user
       FROM readiness_gate_overrides o
       INNER JOIN requirements r ON o.requirement_id = r.id
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN users ra ON r.author_id = ra.id
       LEFT JOIN users uo ON o.overridden_by = uo.id
       LEFT JOIN users ua ON o.approved_by = ua.id
       WHERE o.id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  // Get active override for a requirement
  static async findActiveByRequirementId(requirement_id: string): Promise<ReadinessGateOverride | null> {
    const result = await db.query(
      `SELECT * FROM readiness_gate_overrides
       WHERE requirement_id = $1 AND is_active = true
       AND (valid_until IS NULL OR valid_until > NOW())`,
      [requirement_id]
    );

    return result.rows[0] || null;
  }

  // Get all overrides for a requirement
  static async findByRequirementId(requirement_id: string): Promise<ReadinessGateOverride[]> {
    const result = await db.query(
      `SELECT * FROM readiness_gate_overrides
       WHERE requirement_id = $1
       ORDER BY created_at DESC`,
      [requirement_id]
    );

    return result.rows;
  }

  // Revoke an override
  static async revoke(id: string, revoked_by: string): Promise<ReadinessGateOverride | null> {
    const result = await db.query(
      `UPDATE readiness_gate_overrides
       SET is_active = false, approval_status = 'revoked',
           approved_by = $2, updated_at = NOW()
       WHERE id = $1 AND is_active = true
       RETURNING *`,
      [id, revoked_by]
    );

    return result.rows[0] || null;
  }

  // Update override status
  static async updateStatus(
    id: string,
    status: 'pending' | 'granted' | 'revoked',
    approved_by?: string
  ): Promise<ReadinessGateOverride | null> {
    const result = await db.query(
      `UPDATE readiness_gate_overrides
       SET approval_status = $1, approved_by = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, approved_by, id]
    );

    return result.rows[0] || null;
  }

  // Check if user can access override (via requirement access)
  static async canUserAccess(override_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM readiness_gate_overrides o
       INNER JOIN requirements r ON o.requirement_id = r.id AND r.is_active = true
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       WHERE o.id = $1 AND wm.user_id = $2`,
      [override_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Get overrides by user (who created them)
  static async findByOverriddenBy(user_id: string): Promise<ReadinessGateOverrideWithDetails[]> {
    const result = await db.query(
      `SELECT o.*,
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
              ) as requirement
       FROM readiness_gate_overrides o
       INNER JOIN requirements r ON o.requirement_id = r.id
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN users ra ON r.author_id = ra.id
       WHERE o.overridden_by = $1
       ORDER BY o.created_at DESC`,
      [user_id]
    );

    return result.rows;
  }

  // Clean up expired overrides
  static async cleanupExpiredOverrides(): Promise<number> {
    const result = await db.query(
      `UPDATE readiness_gate_overrides
       SET is_active = false, approval_status = 'revoked', updated_at = NOW()
       WHERE is_active = true AND valid_until IS NOT NULL AND valid_until <= NOW()`
    );

    return result.rowCount || 0;
  }

  // Get project override statistics
  static async getProjectOverrideStats(project_id: string): Promise<{
    total_overrides: number;
    active_overrides: number;
    expired_overrides: number;
    revoked_overrides: number;
  }> {
    const result = await db.query(
      `SELECT
         COUNT(*) as total_overrides,
         COUNT(CASE WHEN is_active = true AND (valid_until IS NULL OR valid_until > NOW()) THEN 1 END) as active_overrides,
         COUNT(CASE WHEN is_active = true AND valid_until IS NOT NULL AND valid_until <= NOW() THEN 1 END) as expired_overrides,
         COUNT(CASE WHEN approval_status = 'revoked' THEN 1 END) as revoked_overrides
       FROM readiness_gate_overrides o
       INNER JOIN requirements r ON o.requirement_id = r.id
       WHERE r.project_id = $1`,
      [project_id]
    );

    const stats = result.rows[0];
    return {
      total_overrides: parseInt(stats.total_overrides),
      active_overrides: parseInt(stats.active_overrides),
      expired_overrides: parseInt(stats.expired_overrides),
      revoked_overrides: parseInt(stats.revoked_overrides)
    };
  }
}