import { db } from '../config/database';
import { Project, CreateProjectRequest, ProjectWithDetails, ProjectWithRepository, User, Workspace, ProjectWithLinearConnection } from './types';
import { LinearConnectionModel } from './LinearConnection';

export class ProjectModel {
  // Create a new project
  static async create(data: CreateProjectRequest, owner_id: string): Promise<Project> {
    const result = await db.query(
      `INSERT INTO projects (
        name, description, workspace_id, owner_id,
        product_area, goals, default_labels, default_persona_stack
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.name,
        data.description,
        data.workspace_id,
        owner_id,
        data.product_area,
        data.goals || [],
        JSON.stringify(data.default_labels || []),
        data.default_persona_stack ? JSON.stringify(data.default_persona_stack) : null
      ]
    );

    return result.rows[0];
  }

  // Get project by ID
  static async findById(id: string): Promise<Project | null> {
    const result = await db.query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get project by ID with workspace and owner details
  static async findByIdWithDetails(id: string): Promise<ProjectWithDetails | null> {
    const result = await db.query(
      `SELECT p.*,
              JSON_BUILD_OBJECT(
                'id', w.id,
                'name', w.name,
                'description', w.description,
                'owner_id', w.owner_id,
                'created_at', w.created_at,
                'updated_at', w.updated_at
              ) as workspace,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as owner
       FROM projects p
       INNER JOIN workspaces w ON p.workspace_id = w.id
       INNER JOIN users u ON p.owner_id = u.id
       WHERE p.id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  // Get all projects in a workspace
  static async findByWorkspaceId(workspace_id: string): Promise<Project[]> {
    const result = await db.query(
      `SELECT * FROM projects
       WHERE workspace_id = $1
       ORDER BY updated_at DESC`,
      [workspace_id]
    );

    return result.rows;
  }

  // Get projects owned by a user
  static async findByOwnerId(owner_id: string): Promise<ProjectWithDetails[]> {
    const result = await db.query(
      `SELECT p.*,
              JSON_BUILD_OBJECT(
                'id', w.id,
                'name', w.name,
                'description', w.description,
                'owner_id', w.owner_id,
                'created_at', w.created_at,
                'updated_at', w.updated_at
              ) as workspace,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as owner
       FROM projects p
       INNER JOIN workspaces w ON p.workspace_id = w.id
       INNER JOIN users u ON p.owner_id = u.id
       WHERE p.owner_id = $1
       ORDER BY p.updated_at DESC`,
      [owner_id]
    );

    return result.rows;
  }

  // Get projects a user has access to (via workspace membership)
  static async findByUserId(user_id: string): Promise<ProjectWithDetails[]> {
    const result = await db.query(
      `SELECT p.*,
              JSON_BUILD_OBJECT(
                'id', w.id,
                'name', w.name,
                'description', w.description,
                'owner_id', w.owner_id,
                'created_at', w.created_at,
                'updated_at', w.updated_at
              ) as workspace,
              JSON_BUILD_OBJECT(
                'id', po.id,
                'username', po.username,
                'email', po.email,
                'name', po.name,
                'avatar_url', po.avatar_url
              ) as owner
       FROM projects p
       INNER JOIN workspaces w ON p.workspace_id = w.id
       INNER JOIN workspace_members wm ON w.id = wm.workspace_id
       INNER JOIN users po ON p.owner_id = po.id
       WHERE wm.user_id = $1 AND p.status = 'active'
       ORDER BY p.updated_at DESC`,
      [user_id]
    );

    return result.rows;
  }

  // Update project
  static async update(id: string, data: Partial<CreateProjectRequest>): Promise<Project | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }

    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }

    if (data.product_area !== undefined) {
      fields.push(`product_area = $${paramIndex++}`);
      values.push(data.product_area);
    }

    if (data.goals !== undefined) {
      fields.push(`goals = $${paramIndex++}`);
      values.push(data.goals);
    }

    if (data.default_labels !== undefined) {
      fields.push(`default_labels = $${paramIndex++}`);
      values.push(JSON.stringify(data.default_labels));
    }

    if (data.default_persona_stack !== undefined) {
      fields.push(`default_persona_stack = $${paramIndex++}`);
      values.push(data.default_persona_stack ? JSON.stringify(data.default_persona_stack) : null);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await db.query(
      `UPDATE projects SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Update project status
  static async updateStatus(id: string, status: 'active' | 'archived' | 'draft'): Promise<Project | null> {
    const result = await db.query(
      `UPDATE projects SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    return result.rows[0] || null;
  }

  // Delete project (soft delete by changing status)
  static async delete(id: string): Promise<boolean> {
    const result = await db.query(
      'UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2',
      ['archived', id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Hard delete project (permanently remove)
  static async hardDelete(id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM projects WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user can access project (via workspace membership)
  static async canUserAccess(project_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM projects p
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       WHERE p.id = $1 AND wm.user_id = $2`,
      [project_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user owns project
  static async isUserOwner(project_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      'SELECT 1 FROM projects WHERE id = $1 AND owner_id = $2',
      [project_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

<<<<<<< HEAD
  // Get project by ID with Linear connection details
  static async findByIdWithLinearConnection(id: string): Promise<ProjectWithLinearConnection | null> {
    const projectWithDetails = await this.findByIdWithDetails(id);
    if (!projectWithDetails) return null;

    const linearConnection = await LinearConnectionModel.findByProjectId(id);

    return {
      ...projectWithDetails,
      linear_connection: linearConnection || undefined,
    };
  }

  // Get projects a user has access to with Linear connection status
  static async findByUserIdWithLinearConnection(user_id: string): Promise<ProjectWithLinearConnection[]> {
    const projects = await this.findByUserId(user_id);

    // Fetch Linear connections for all projects in parallel
    const projectsWithLinear = await Promise.all(
      projects.map(async (project) => {
        const linearConnection = await LinearConnectionModel.findByProjectId(project.id);
        return {
          ...project,
          linear_connection: linearConnection || undefined,
        };
      })
    );

    return projectsWithLinear;
  }


  // Get project by ID with details and GitHub repository
  static async findByIdWithRepository(id: string): Promise<ProjectWithRepository | null> {
    const result = await db.query(
      `SELECT p.*,
              JSON_BUILD_OBJECT(
                'id', w.id,
                'name', w.name,
                'description', w.description,
                'owner_id', w.owner_id,
                'created_at', w.created_at,
                'updated_at', w.updated_at
              ) as workspace,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'github_id', u.github_id,
                'username', u.username,
                'email', u.email,
                'avatar_url', u.avatar_url,
                'name', u.name,
                'created_at', u.created_at,
                'updated_at', u.updated_at
              ) as owner,
              CASE
                WHEN gr.id IS NOT NULL THEN
                  JSON_BUILD_OBJECT(
                    'id', gr.id,
                    'project_id', gr.project_id,
                    'github_repo_id', gr.github_repo_id,
                    'name', gr.name,
                    'full_name', gr.full_name,
                    'description', gr.description,
                    'html_url', gr.html_url,
                    'clone_url', gr.clone_url,
                    'ssh_url', gr.ssh_url,
                    'private', gr.private,
                    'default_branch', gr.default_branch,
                    'language', gr.language,
                    'topics', gr.topics,
                    'access_level', gr.access_level,
                    'webhook_configured', gr.webhook_configured,
                    'created_at', gr.created_at,
                    'updated_at', gr.updated_at
                  )
                ELSE NULL
              END as github_repository
       FROM projects p
       INNER JOIN workspaces w ON p.workspace_id = w.id
       INNER JOIN users u ON p.owner_id = u.id
       LEFT JOIN github_repositories gr ON p.id = gr.project_id
       WHERE p.id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }
}