import { db } from '../config/database';
import {
  Requirement,
  CreateRequirementRequest,
  RequirementWithDetails,
  User,
  Project,
  CreateRequirementAdvancedRequest,
  RequirementWorkflowDetails,
  UpdateRequirementAssignmentRequest,
  UpdateRequirementStatusRequest,
  UpdateRequirementPriorityRequest,
  UpdateRequirementLifecycleRequest
} from './types';
import { RequirementHistoryModel } from './RequirementHistory';
import { RequirementCommentModel } from './RequirementComment';
import { RequirementWatcherModel } from './RequirementWatcher';
import { RequirementDependencyModel } from './RequirementDependency';

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

    const requirement = result.rows[0];

    // Auto-add watchers
    await RequirementWatcherModel.autoAddWatchers(requirement.id);

    return requirement;
  }

  // Create a new requirement with advanced workflow features
  static async createAdvanced(data: CreateRequirementAdvancedRequest, author_id: string): Promise<Requirement> {
    const priority_label = data.priority_label || this.getPriorityLabel(data.priority || 3);

    const result = await db.query(
      `INSERT INTO requirements (
        title, description, project_id, author_id, priority, type,
        github_issue_number, github_issue_url, assignee_id, assigned_by,
        priority_label, due_date, estimated_hours, story_points, labels, metadata
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        data.title,
        data.description,
        data.project_id,
        author_id,
        data.priority || 3,
        data.type || 'feature',
        data.github_issue_number,
        data.github_issue_url,
        data.assignee_id || null,
        data.assignee_id ? author_id : null, // assigned_by is the creator if assignee is set
        priority_label,
        data.due_date ? new Date(data.due_date) : null,
        data.estimated_hours,
        data.story_points,
        JSON.stringify(data.labels || []),
        JSON.stringify(data.metadata || {})
      ]
    );

    const requirement = result.rows[0];

    // Set assigned_at if assignee is provided
    if (data.assignee_id) {
      await db.query(
        'UPDATE requirements SET assigned_at = NOW() WHERE id = $1',
        [requirement.id]
      );
    }

    // Auto-add watchers (including author, assignee, project owner)
    await RequirementWatcherModel.autoAddWatchers(requirement.id);

    // Add additional watchers if specified
    if (data.watchers && data.watchers.length > 0) {
      await RequirementWatcherModel.addWatchers(requirement.id, data.watchers);
    }

    // Log creation in history
    await RequirementHistoryModel.logChange(
      requirement.id,
      author_id,
      'created',
      undefined,
      'requirement created'
    );

    return requirement;
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

  // (updateStatus method moved to advanced workflow section below)

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

<<<<<<< HEAD
<<<<<<< HEAD
  // Advanced workflow methods for B-404, B-405, B-406, B-407

  // Get requirement with full workflow details
  static async findByIdWithWorkflowDetails(id: string): Promise<RequirementWorkflowDetails | null> {
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
                'id', author.id,
                'username', author.username,
                'email', author.email,
                'name', author.name,
                'avatar_url', author.avatar_url
              ) as author,
              CASE WHEN r.assignee_id IS NOT NULL THEN
                JSON_BUILD_OBJECT(
                  'id', assignee.id,
                  'username', assignee.username,
                  'email', assignee.email,
                  'name', assignee.name,
                  'avatar_url', assignee.avatar_url
                )
              ELSE NULL END as assignee,
              CASE WHEN r.assigned_by IS NOT NULL THEN
                JSON_BUILD_OBJECT(
                  'id', assigned_by.id,
                  'username', assigned_by.username,
                  'email', assigned_by.email,
                  'name', assigned_by.name,
                  'avatar_url', assigned_by.avatar_url
                )
              ELSE NULL END as assigned_by_user
       FROM requirements r
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN users author ON r.author_id = author.id
       LEFT JOIN users assignee ON r.assignee_id = assignee.id
       LEFT JOIN users assigned_by ON r.assigned_by = assigned_by.id
       WHERE r.id = $1 AND r.is_active = true`,
      [id]
    );

    if (!result.rows[0]) return null;

    const requirement = result.rows[0];

    // Get comments, watchers, dependencies, and history
    const [comments, watchers, dependencies, blocking, history] = await Promise.all([
      RequirementCommentModel.findByRequirementId(id),
      RequirementWatcherModel.findByRequirementId(id),
      RequirementDependencyModel.findByRequirementId(id),
      RequirementDependencyModel.findBlockedBy(id),
      RequirementHistoryModel.findByRequirementId(id)
    ]);

    return {
      ...requirement,
      comments,
      watchers,
      dependencies,
      blocking,
      history
    };
  }

  // B-405: Assignment management
  static async updateAssignment(
    requirement_id: string,
    data: UpdateRequirementAssignmentRequest,
    updated_by: string
  ): Promise<Requirement | null> {
    // Get current requirement to check for changes
    const current = await this.findById(requirement_id);
    if (!current) return null;

    const old_assignee = current.assignee_id;
    const new_assignee = data.assignee_id;

    // Update assignment
    const result = await db.query(
      `UPDATE requirements
       SET assignee_id = $1,
           assigned_by = $2,
           assigned_at = CASE WHEN $1 IS NOT NULL THEN NOW() ELSE NULL END,
           updated_at = NOW()
       WHERE id = $3 AND is_active = true
       RETURNING *`,
      [new_assignee, new_assignee ? updated_by : null, requirement_id]
    );

    if (!result.rows[0]) return null;

    // Log assignment change in history
    await RequirementHistoryModel.logAssignmentChange(
      requirement_id,
      updated_by,
      old_assignee,
      new_assignee,
      data.change_reason
    );

    // Create system comment about assignment change
    if (old_assignee !== new_assignee) {
      let comment_content;
      if (!old_assignee && new_assignee) {
        comment_content = `Assigned to user ${new_assignee}`;
      } else if (old_assignee && !new_assignee) {
        comment_content = `Unassigned from user ${old_assignee}`;
      } else {
        comment_content = `Reassigned from user ${old_assignee} to user ${new_assignee}`;
      }

      await RequirementCommentModel.createSystemComment(
        requirement_id,
        updated_by,
        'assignment_change',
        comment_content,
        { old_assignee, new_assignee, change_reason: data.change_reason }
      );

      // Auto-watch new assignee
      if (new_assignee) {
        await RequirementWatcherModel.addWatcher(requirement_id, new_assignee);
      }
    }

    return result.rows[0];
  }

  // B-404: Advanced status workflow
  static async updateStatus(
    requirement_id: string,
    data: UpdateRequirementStatusRequest,
    updated_by: string
  ): Promise<Requirement | null> {
    // Get current requirement to check for changes and workflow rules
    const current = await this.findById(requirement_id);
    if (!current) return null;

    // Check workflow rules
    if (data.status === 'in_progress') {
      const hasBlockingDeps = await RequirementDependencyModel.hasBlockingDependencies(requirement_id);
      if (hasBlockingDeps) {
        throw new Error('Cannot start work on requirement with incomplete blocking dependencies');
      }
    }

    const old_status = current.status;
    const new_status = data.status;

    // Build update query with conditional fields
    const updateFields = ['status = $1', 'updated_at = NOW()'];
    const updateValues: any[] = [new_status];
    let paramIndex = 2;

    // Add resolution fields if status is being completed/cancelled
    if (['completed', 'cancelled', 'archived'].includes(new_status)) {
      updateFields.push(`resolution = $${paramIndex++}`);
      updateFields.push(`resolution_notes = $${paramIndex++}`);
      updateValues.push(data.resolution || 'done');
      updateValues.push(data.resolution_notes || null);
    }

    updateValues.push(requirement_id);

    const result = await db.query(
      `UPDATE requirements
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex} AND is_active = true
       RETURNING *`,
      updateValues
    );

    if (!result.rows[0]) return null;

    // Log status change in history
    await RequirementHistoryModel.logStatusChange(
      requirement_id,
      updated_by,
      old_status,
      new_status,
      data.change_reason
    );

    // Create system comment about status change
    if (old_status !== new_status) {
      let comment_content = `Status changed from ${old_status} to ${new_status}`;
      if (data.resolution) {
        comment_content += ` with resolution: ${data.resolution}`;
      }

      await RequirementCommentModel.createSystemComment(
        requirement_id,
        updated_by,
        'status_change',
        comment_content,
        {
          old_status,
          new_status,
          resolution: data.resolution,
          resolution_notes: data.resolution_notes,
          change_reason: data.change_reason
        }
      );
    }

    return result.rows[0];
  }

  // B-406: Advanced priority management
  static async updatePriority(
    requirement_id: string,
    data: UpdateRequirementPriorityRequest,
    updated_by: string
  ): Promise<Requirement | null> {
    // Get current requirement to check for changes
    const current = await this.findById(requirement_id);
    if (!current) return null;

    const old_priority = current.priority;
    const old_priority_label = current.priority_label;
    const new_priority = data.priority || current.priority;
    const new_priority_label = data.priority_label || this.getPriorityLabel(new_priority);

    const result = await db.query(
      `UPDATE requirements
       SET priority = $1,
           priority_label = $2,
           urgency_score = $3,
           due_date = $4,
           updated_at = NOW()
       WHERE id = $5 AND is_active = true
       RETURNING *`,
      [
        new_priority,
        new_priority_label,
        data.urgency_score,
        data.due_date ? new Date(data.due_date) : null,
        requirement_id
      ]
    );

    if (!result.rows[0]) return null;

    // Log priority change in history if priority changed
    if (old_priority !== new_priority) {
      await RequirementHistoryModel.logPriorityChange(
        requirement_id,
        updated_by,
        old_priority,
        new_priority,
        data.change_reason
      );

      // Create system comment about priority change
      await RequirementCommentModel.createSystemComment(
        requirement_id,
        updated_by,
        'priority_change',
        `Priority changed from ${old_priority} (${old_priority_label}) to ${new_priority} (${new_priority_label})`,
        {
          old_priority,
          new_priority,
          old_priority_label,
          new_priority_label,
          urgency_score: data.urgency_score,
          due_date: data.due_date,
          change_reason: data.change_reason
        }
      );
    }

    return result.rows[0];
  }

  // B-407: Lifecycle management
  static async updateLifecycle(
    requirement_id: string,
    data: UpdateRequirementLifecycleRequest,
    updated_by: string
  ): Promise<Requirement | null> {
    const result = await db.query(
      `UPDATE requirements
       SET estimated_hours = $1,
           actual_hours = $2,
           story_points = $3,
           labels = $4,
           metadata = $5,
           updated_at = NOW()
       WHERE id = $6 AND is_active = true
       RETURNING *`,
      [
        data.estimated_hours,
        data.actual_hours,
        data.story_points,
        data.labels ? JSON.stringify(data.labels) : null,
        data.metadata ? JSON.stringify(data.metadata) : null,
        requirement_id
      ]
    );

    if (result.rows[0]) {
      // Log lifecycle update in history
      await RequirementHistoryModel.logChange(
        requirement_id,
        updated_by,
        'lifecycle_update',
        undefined,
        'Updated lifecycle fields (estimates, story points, labels, metadata)'
      );
    }

    return result.rows[0] || null;
  }

  // Helper method to convert numeric priority to label
  static getPriorityLabel(priority: number): string {
    switch (priority) {
      case 1: return 'critical';
      case 2: return 'high';
      case 3: return 'medium';
      case 4: return 'low';
      case 5: return 'backlog';
      default: return 'medium';
    }
  }

  // Get requirements by status for workflow management
  static async findByStatus(
    project_id: string,
    status: string
  ): Promise<RequirementWithDetails[]> {
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
=======
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
>>>>>>> dust-polecat/polecat/nitro/gt-x4x
              ) as project,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
<<<<<<< HEAD
                'email', u.email,
=======
>>>>>>> dust-polecat/polecat/nitro/gt-x4x
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as author
       FROM requirements r
       INNER JOIN projects p ON r.project_id = p.id
<<<<<<< HEAD
       INNER JOIN users u ON r.author_id = u.id
       WHERE r.project_id = $1 AND r.status = $2 AND r.is_active = true
       ORDER BY r.priority ASC, r.updated_at DESC`,
      [project_id, status]
    );

    return result.rows;
  }

  // Get requirements assigned to a user
  static async findByAssignee(assignee_id: string): Promise<RequirementWithDetails[]> {
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
       WHERE r.assignee_id = $1 AND r.is_active = true
       ORDER BY r.priority ASC, r.due_date ASC NULLS LAST, r.updated_at DESC`,
      [assignee_id]
    );

    return result.rows;
  }

  // Check if user can modify requirement (author, assignee, or project member with admin/owner role)
  static async canUserModify(requirement_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM requirements r
       INNER JOIN projects p ON r.project_id = p.id
       LEFT JOIN workspace_members wm ON p.workspace_id = wm.workspace_id AND wm.user_id = $2
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
       WHERE r.id = $1 AND r.is_active = true
       AND (
         r.author_id = $2 OR                    -- Author can modify
         r.assignee_id = $2 OR                  -- Assignee can modify
         p.owner_id = $2 OR                     -- Project owner can modify
         wm.role IN ('owner', 'admin') OR       -- Workspace admin/owner can modify
         pm.role IN ('owner', 'admin')          -- Project admin/owner can modify
       )`,
      [requirement_id, user_id]
=======
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
>>>>>>> dust-polecat/polecat/nitro/gt-x4x
    );

    return (result.rowCount ?? 0) > 0;
  }
<<<<<<< HEAD
=======
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
>>>>>>> check-fury-w8a
=======

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
>>>>>>> dust-polecat/polecat/nitro/gt-x4x
}