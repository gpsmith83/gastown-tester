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

  // Get summary statistics for a project
  static async getProjectSummary(project_id: string) {
    const result = await db.query(
      `SELECT
        COUNT(*) as total_requirements,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
        COUNT(*) FILTER (WHERE status = 'active') as active_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'archived') as archived_count,
        COUNT(*) FILTER (WHERE type = 'feature') as feature_count,
        COUNT(*) FILTER (WHERE type = 'bug') as bug_count,
        COUNT(*) FILTER (WHERE type = 'enhancement') as enhancement_count,
        COUNT(*) FILTER (WHERE type = 'epic') as epic_count,
        COUNT(*) FILTER (WHERE priority = 1) as priority_1_count,
        COUNT(*) FILTER (WHERE priority = 2) as priority_2_count,
        COUNT(*) FILTER (WHERE priority = 3) as priority_3_count,
        COUNT(*) FILTER (WHERE priority = 4) as priority_4_count,
        COUNT(*) FILTER (WHERE priority = 5) as priority_5_count,
        AVG(priority) as average_priority,
        COUNT(DISTINCT author_id) as unique_authors,
        MAX(updated_at) as last_updated,
        COUNT(*) FILTER (WHERE github_issue_number IS NOT NULL) as github_linked_count
       FROM requirements
       WHERE project_id = $1 AND is_active = true`,
      [project_id]
    );

    const stats = result.rows[0];

    return {
      totals: {
        requirements: parseInt(stats.total_requirements),
        unique_authors: parseInt(stats.unique_authors),
        github_linked: parseInt(stats.github_linked_count),
      },
      status_breakdown: {
        draft: parseInt(stats.draft_count),
        active: parseInt(stats.active_count),
        completed: parseInt(stats.completed_count),
        archived: parseInt(stats.archived_count),
      },
      type_breakdown: {
        feature: parseInt(stats.feature_count),
        bug: parseInt(stats.bug_count),
        enhancement: parseInt(stats.enhancement_count),
        epic: parseInt(stats.epic_count),
      },
      priority_breakdown: {
        priority_1: parseInt(stats.priority_1_count),
        priority_2: parseInt(stats.priority_2_count),
        priority_3: parseInt(stats.priority_3_count),
        priority_4: parseInt(stats.priority_4_count),
        priority_5: parseInt(stats.priority_5_count),
        average: parseFloat(stats.average_priority || '0'),
      },
      last_updated: stats.last_updated,
    };
  }

  // Get summary statistics for all requirements user has access to
  static async getUserSummary(user_id: string) {
    const result = await db.query(
      `SELECT
        COUNT(*) as total_requirements,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
        COUNT(*) FILTER (WHERE status = 'active') as active_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'archived') as archived_count,
        COUNT(*) FILTER (WHERE type = 'feature') as feature_count,
        COUNT(*) FILTER (WHERE type = 'bug') as bug_count,
        COUNT(*) FILTER (WHERE type = 'enhancement') as enhancement_count,
        COUNT(*) FILTER (WHERE type = 'epic') as epic_count,
        COUNT(*) FILTER (WHERE priority = 1) as priority_1_count,
        COUNT(*) FILTER (WHERE priority = 2) as priority_2_count,
        COUNT(*) FILTER (WHERE priority = 3) as priority_3_count,
        COUNT(*) FILTER (WHERE priority = 4) as priority_4_count,
        COUNT(*) FILTER (WHERE priority = 5) as priority_5_count,
        AVG(priority) as average_priority,
        COUNT(DISTINCT r.author_id) as unique_authors,
        COUNT(DISTINCT r.project_id) as unique_projects,
        MAX(r.updated_at) as last_updated,
        COUNT(*) FILTER (WHERE github_issue_number IS NOT NULL) as github_linked_count,
        COUNT(*) FILTER (WHERE r.author_id = $1) as authored_by_user
       FROM requirements r
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       WHERE wm.user_id = $1 AND r.is_active = true`,
      [user_id]
    );

    const stats = result.rows[0];

    return {
      totals: {
        requirements: parseInt(stats.total_requirements),
        unique_authors: parseInt(stats.unique_authors),
        unique_projects: parseInt(stats.unique_projects),
        authored_by_user: parseInt(stats.authored_by_user),
        github_linked: parseInt(stats.github_linked_count),
      },
      status_breakdown: {
        draft: parseInt(stats.draft_count),
        active: parseInt(stats.active_count),
        completed: parseInt(stats.completed_count),
        archived: parseInt(stats.archived_count),
      },
      type_breakdown: {
        feature: parseInt(stats.feature_count),
        bug: parseInt(stats.bug_count),
        enhancement: parseInt(stats.enhancement_count),
        epic: parseInt(stats.epic_count),
      },
      priority_breakdown: {
        priority_1: parseInt(stats.priority_1_count),
        priority_2: parseInt(stats.priority_2_count),
        priority_3: parseInt(stats.priority_3_count),
        priority_4: parseInt(stats.priority_4_count),
        priority_5: parseInt(stats.priority_5_count),
        average: parseFloat(stats.average_priority || '0'),
      },
      last_updated: stats.last_updated,
    };
  }

  // Get recent activity for a project (recently updated requirements)
  static async getProjectActivity(project_id: string, limit: number = 10) {
    const result = await db.query(
      `SELECT r.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as author
       FROM requirements r
       INNER JOIN users u ON r.author_id = u.id
       WHERE r.project_id = $1 AND r.is_active = true
       ORDER BY r.updated_at DESC
       LIMIT $2`,
      [project_id, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      status: row.status,
      type: row.type,
      priority: row.priority,
      author: row.author,
      updated_at: row.updated_at,
      created_at: row.created_at,
    }));
  }

  // Get comprehensive dashboard data for a user
  static async getDashboardData(user_id: string) {
    // Get user summary
    const summary = await this.getUserSummary(user_id);

    // Get recent requirements across all accessible projects
    const recentResult = await db.query(
      `SELECT r.*,
              JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name
              ) as project,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as author
       FROM requirements r
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       INNER JOIN users u ON r.author_id = u.id
       WHERE wm.user_id = $1 AND r.is_active = true
       ORDER BY r.updated_at DESC
       LIMIT 10`,
      [user_id]
    );

    // Get requirements authored by user
    const myRequirementsResult = await db.query(
      `SELECT r.*,
              JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name
              ) as project
       FROM requirements r
       INNER JOIN projects p ON r.project_id = p.id
       WHERE r.author_id = $1 AND r.is_active = true
       ORDER BY r.updated_at DESC
       LIMIT 5`,
      [user_id]
    );

    // Get project summaries for all accessible projects
    const projectSummariesResult = await db.query(
      `SELECT p.id, p.name,
              COUNT(r.*) as total_requirements,
              COUNT(r.*) FILTER (WHERE r.status = 'active') as active_requirements,
              COUNT(r.*) FILTER (WHERE r.status = 'completed') as completed_requirements,
              MAX(r.updated_at) as last_requirement_update
       FROM projects p
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       LEFT JOIN requirements r ON p.id = r.project_id AND r.is_active = true
       WHERE wm.user_id = $1
       GROUP BY p.id, p.name
       ORDER BY last_requirement_update DESC NULLS LAST`,
      [user_id]
    );

    return {
      summary,
      recent_activity: recentResult.rows.map(row => ({
        id: row.id,
        title: row.title,
        status: row.status,
        type: row.type,
        priority: row.priority,
        project: row.project,
        author: row.author,
        updated_at: row.updated_at,
        created_at: row.created_at,
      })),
      my_requirements: myRequirementsResult.rows.map(row => ({
        id: row.id,
        title: row.title,
        status: row.status,
        type: row.type,
        priority: row.priority,
        project: row.project,
        updated_at: row.updated_at,
        created_at: row.created_at,
      })),
      project_summaries: projectSummariesResult.rows.map(row => ({
        project_id: row.id,
        project_name: row.name,
        total_requirements: parseInt(row.total_requirements),
        active_requirements: parseInt(row.active_requirements),
        completed_requirements: parseInt(row.completed_requirements),
        last_requirement_update: row.last_requirement_update,
      })),
    };
  }

  // Check if user can access workspace
  static async canUserAccessWorkspace(workspace_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2`,
      [workspace_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Get summary statistics for all requirements in a workspace
  static async getWorkspaceSummary(workspace_id: string) {
    const result = await db.query(
      `SELECT
        COUNT(*) as total_requirements,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
        COUNT(*) FILTER (WHERE status = 'active') as active_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'archived') as archived_count,
        COUNT(*) FILTER (WHERE type = 'feature') as feature_count,
        COUNT(*) FILTER (WHERE type = 'bug') as bug_count,
        COUNT(*) FILTER (WHERE type = 'enhancement') as enhancement_count,
        COUNT(*) FILTER (WHERE type = 'epic') as epic_count,
        COUNT(*) FILTER (WHERE priority = 1) as priority_1_count,
        COUNT(*) FILTER (WHERE priority = 2) as priority_2_count,
        COUNT(*) FILTER (WHERE priority = 3) as priority_3_count,
        COUNT(*) FILTER (WHERE priority = 4) as priority_4_count,
        COUNT(*) FILTER (WHERE priority = 5) as priority_5_count,
        AVG(priority) as average_priority,
        COUNT(DISTINCT r.author_id) as unique_authors,
        COUNT(DISTINCT r.project_id) as unique_projects,
        MAX(r.updated_at) as last_updated,
        COUNT(*) FILTER (WHERE github_issue_number IS NOT NULL) as github_linked_count
       FROM requirements r
       INNER JOIN projects p ON r.project_id = p.id
       WHERE p.workspace_id = $1 AND r.is_active = true`,
      [workspace_id]
    );

    const stats = result.rows[0];

    // Get project breakdown
    const projectBreakdownResult = await db.query(
      `SELECT p.id, p.name,
              COUNT(r.*) as total_requirements,
              COUNT(r.*) FILTER (WHERE r.status = 'active') as active_requirements,
              COUNT(r.*) FILTER (WHERE r.status = 'completed') as completed_requirements,
              COUNT(r.*) FILTER (WHERE r.status = 'draft') as draft_requirements,
              AVG(r.priority) as avg_priority,
              MAX(r.updated_at) as last_updated
       FROM projects p
       LEFT JOIN requirements r ON p.id = r.project_id AND r.is_active = true
       WHERE p.workspace_id = $1
       GROUP BY p.id, p.name
       ORDER BY total_requirements DESC`,
      [workspace_id]
    );

    return {
      totals: {
        requirements: parseInt(stats.total_requirements),
        unique_authors: parseInt(stats.unique_authors),
        unique_projects: parseInt(stats.unique_projects),
        github_linked: parseInt(stats.github_linked_count),
      },
      status_breakdown: {
        draft: parseInt(stats.draft_count),
        active: parseInt(stats.active_count),
        completed: parseInt(stats.completed_count),
        archived: parseInt(stats.archived_count),
      },
      type_breakdown: {
        feature: parseInt(stats.feature_count),
        bug: parseInt(stats.bug_count),
        enhancement: parseInt(stats.enhancement_count),
        epic: parseInt(stats.epic_count),
      },
      priority_breakdown: {
        priority_1: parseInt(stats.priority_1_count),
        priority_2: parseInt(stats.priority_2_count),
        priority_3: parseInt(stats.priority_3_count),
        priority_4: parseInt(stats.priority_4_count),
        priority_5: parseInt(stats.priority_5_count),
        average: parseFloat(stats.average_priority || '0'),
      },
      project_breakdown: projectBreakdownResult.rows.map(row => ({
        project_id: row.id,
        project_name: row.name,
        total_requirements: parseInt(row.total_requirements),
        active_requirements: parseInt(row.active_requirements),
        completed_requirements: parseInt(row.completed_requirements),
        draft_requirements: parseInt(row.draft_requirements),
        avg_priority: parseFloat(row.avg_priority || '0'),
        last_updated: row.last_updated,
      })),
      last_updated: stats.last_updated,
    };
  }
}