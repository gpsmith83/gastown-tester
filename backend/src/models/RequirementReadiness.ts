import { db } from '../config/database';
import {
  RequirementReadiness,
  RequirementReadinessWithDetails,
  CreateRequirementReadinessRequest
} from './types';

export class RequirementReadinessModel {
  // Create or update readiness for a requirement
  static async upsert(data: CreateRequirementReadinessRequest): Promise<RequirementReadiness> {
    // Calculate overall score if not provided
    const overall_score = data.overall_score ?? this.calculateOverallScore({
      clarity_score: data.clarity_score,
      completeness_score: data.completeness_score,
      testability_score: data.testability_score,
      feasibility_score: data.feasibility_score,
      specificity_score: data.specificity_score
    });

    // Determine readiness level if not provided
    const readiness_level = data.readiness_level ?? this.determineReadinessLevel(overall_score);

    const result = await db.query(
      `INSERT INTO requirement_readiness (
        requirement_id, clarity_score, completeness_score, testability_score,
        feasibility_score, specificity_score, overall_score, readiness_level,
        analysis_source, confidence_score, missing_areas, recommendations,
        computed_from_summary_id, ai_model, analysis_metadata
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (requirement_id)
       DO UPDATE SET
         clarity_score = EXCLUDED.clarity_score,
         completeness_score = EXCLUDED.completeness_score,
         testability_score = EXCLUDED.testability_score,
         feasibility_score = EXCLUDED.feasibility_score,
         specificity_score = EXCLUDED.specificity_score,
         overall_score = EXCLUDED.overall_score,
         readiness_level = EXCLUDED.readiness_level,
         analysis_source = EXCLUDED.analysis_source,
         confidence_score = EXCLUDED.confidence_score,
         missing_areas = EXCLUDED.missing_areas,
         recommendations = EXCLUDED.recommendations,
         computed_from_summary_id = EXCLUDED.computed_from_summary_id,
         ai_model = EXCLUDED.ai_model,
         analysis_metadata = EXCLUDED.analysis_metadata,
         computation_version = computation_version + 1,
         updated_at = NOW()
       RETURNING *`,
      [
        data.requirement_id,
        data.clarity_score,
        data.completeness_score,
        data.testability_score,
        data.feasibility_score,
        data.specificity_score,
        overall_score,
        readiness_level,
        data.analysis_source || 'ai_analysis',
        data.confidence_score,
        data.missing_areas,
        data.recommendations,
        data.computed_from_summary_id,
        data.ai_model,
        data.analysis_metadata ? JSON.stringify(data.analysis_metadata) : null
      ]
    );

    return result.rows[0];
  }

  // Get readiness by requirement ID
  static async findByRequirementId(requirement_id: string): Promise<RequirementReadiness | null> {
    const result = await db.query(
      'SELECT * FROM requirement_readiness WHERE requirement_id = $1',
      [requirement_id]
    );

    return result.rows[0] || null;
  }

  // Get readiness with full details
  static async findByRequirementIdWithDetails(requirement_id: string): Promise<RequirementReadinessWithDetails | null> {
    const result = await db.query(
      `SELECT rr.*,
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
                WHEN rr.computed_from_summary_id IS NOT NULL THEN
                  JSON_BUILD_OBJECT(
                    'id', rs.id,
                    'requirement_id', rs.requirement_id,
                    'session_id', rs.session_id,
                    'title', rs.title,
                    'summary', rs.summary,
                    'key_points', rs.key_points,
                    'clarifications_made', rs.clarifications_made,
                    'outstanding_questions', rs.outstanding_questions,
                    'message_count', rs.message_count,
                    'confidence_score', rs.confidence_score,
                    'summary_type', rs.summary_type,
                    'generated_by', rs.generated_by,
                    'version', rs.version,
                    'created_at', rs.created_at,
                    'updated_at', rs.updated_at
                  )
                ELSE NULL
              END as computed_from_summary
       FROM requirement_readiness rr
       INNER JOIN requirements r ON rr.requirement_id = r.id
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN users ra ON r.author_id = ra.id
       LEFT JOIN refinement_summaries rs ON rr.computed_from_summary_id = rs.id
       WHERE rr.requirement_id = $1`,
      [requirement_id]
    );

    return result.rows[0] || null;
  }

  // Get readiness by ID
  static async findById(id: string): Promise<RequirementReadiness | null> {
    const result = await db.query(
      'SELECT * FROM requirement_readiness WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Delete readiness record
  static async delete(id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM requirement_readiness WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user can access readiness (via requirement access)
  static async canUserAccess(readiness_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM requirement_readiness rr
       INNER JOIN requirements r ON rr.requirement_id = r.id AND r.is_active = true
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       WHERE rr.id = $1 AND wm.user_id = $2`,
      [readiness_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Get requirements by readiness level
  static async findRequirementsByReadinessLevel(
    readiness_level: 'not_ready' | 'partially_ready' | 'ready' | 'fully_ready',
    user_id: string
  ): Promise<RequirementReadinessWithDetails[]> {
    const result = await db.query(
      `SELECT rr.*,
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
       FROM requirement_readiness rr
       INNER JOIN requirements r ON rr.requirement_id = r.id AND r.is_active = true
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN users ra ON r.author_id = ra.id
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       WHERE rr.readiness_level = $1 AND wm.user_id = $2
       ORDER BY rr.overall_score DESC, r.priority ASC`,
      [readiness_level, user_id]
    );

    return result.rows;
  }

  // Calculate overall readiness score from dimension scores
  private static calculateOverallScore(scores: {
    clarity_score: number;
    completeness_score: number;
    testability_score: number;
    feasibility_score: number;
    specificity_score: number;
  }): number {
    // Weighted average - some dimensions are more important than others
    const weights = {
      clarity: 0.25,      // Very important - requirement must be clear
      completeness: 0.25, // Very important - must have all necessary details
      testability: 0.20,  // Important - needs measurable criteria
      feasibility: 0.15,  // Moderately important - must be achievable
      specificity: 0.15   // Moderately important - must be actionable
    };

    const weighted_score =
      scores.clarity_score * weights.clarity +
      scores.completeness_score * weights.completeness +
      scores.testability_score * weights.testability +
      scores.feasibility_score * weights.feasibility +
      scores.specificity_score * weights.specificity;

    // Round to 2 decimal places
    return Math.round(weighted_score * 100) / 100;
  }

  // Determine readiness level from overall score
  private static determineReadinessLevel(overall_score: number): 'not_ready' | 'partially_ready' | 'ready' | 'fully_ready' {
    if (overall_score >= 0.9) return 'fully_ready';
    if (overall_score >= 0.7) return 'ready';
    if (overall_score >= 0.4) return 'partially_ready';
    return 'not_ready';
  }

  // Get readiness statistics for a project
  static async getProjectReadinessStats(project_id: string): Promise<{
    total_requirements: number;
    not_ready: number;
    partially_ready: number;
    ready: number;
    fully_ready: number;
    average_score: number;
  }> {
    const result = await db.query(
      `SELECT
         COUNT(r.id) as total_requirements,
         COUNT(CASE WHEN rr.readiness_level = 'not_ready' THEN 1 END) as not_ready,
         COUNT(CASE WHEN rr.readiness_level = 'partially_ready' THEN 1 END) as partially_ready,
         COUNT(CASE WHEN rr.readiness_level = 'ready' THEN 1 END) as ready,
         COUNT(CASE WHEN rr.readiness_level = 'fully_ready' THEN 1 END) as fully_ready,
         COALESCE(AVG(rr.overall_score), 0) as average_score
       FROM requirements r
       LEFT JOIN requirement_readiness rr ON r.id = rr.requirement_id
       WHERE r.project_id = $1 AND r.is_active = true`,
      [project_id]
    );

    const stats = result.rows[0];
    return {
      total_requirements: parseInt(stats.total_requirements),
      not_ready: parseInt(stats.not_ready),
      partially_ready: parseInt(stats.partially_ready),
      ready: parseInt(stats.ready),
      fully_ready: parseInt(stats.fully_ready),
      average_score: parseFloat(stats.average_score) || 0
    };
  }
}