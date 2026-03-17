import { db } from '../config/database';
import { Workspace, WorkspaceMember, CreateWorkspaceRequest, WorkspaceWithProjects, User } from './types';

export class WorkspaceModel {
  // Create a new workspace
  static async create(data: CreateWorkspaceRequest, owner_id: string): Promise<Workspace> {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Create the workspace
      const workspaceResult = await client.query(
        `INSERT INTO workspaces (name, description, owner_id)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [data.name, data.description, owner_id]
      );

      const workspace = workspaceResult.rows[0];

      // Add the owner as a workspace member with 'owner' role
      await client.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [workspace.id, owner_id]
      );

      await client.query('COMMIT');
      return workspace;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get workspace by ID
  static async findById(id: string): Promise<Workspace | null> {
    const result = await db.query(
      'SELECT * FROM workspaces WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get all workspaces for a user (where they are a member)
  static async findByUserId(user_id: string): Promise<WorkspaceWithProjects[]> {
    const result = await db.query(
      `SELECT w.*,
              COALESCE(project_counts.count, 0) as project_count,
              COALESCE(member_counts.count, 0) as member_count,
              JSON_AGG(
                JSON_BUILD_OBJECT(
                  'id', p.id,
                  'name', p.name,
                  'description', p.description,
                  'product_area', p.product_area,
                  'status', p.status,
                  'created_at', p.created_at,
                  'updated_at', p.updated_at
                ) ORDER BY p.created_at DESC
              ) FILTER (WHERE p.id IS NOT NULL) as projects
       FROM workspaces w
       INNER JOIN workspace_members wm ON w.id = wm.workspace_id
       LEFT JOIN projects p ON w.id = p.workspace_id AND p.status = 'active'
       LEFT JOIN (
         SELECT workspace_id, COUNT(*) as count
         FROM projects
         WHERE status = 'active'
         GROUP BY workspace_id
       ) project_counts ON w.id = project_counts.workspace_id
       LEFT JOIN (
         SELECT workspace_id, COUNT(*) as count
         FROM workspace_members
         GROUP BY workspace_id
       ) member_counts ON w.id = member_counts.workspace_id
       WHERE wm.user_id = $1
       GROUP BY w.id, project_counts.count, member_counts.count
       ORDER BY w.updated_at DESC`,
      [user_id]
    );

    return result.rows.map(row => ({
      ...row,
      projects: row.projects || []
    }));
  }

  // Update workspace
  static async update(id: string, data: Partial<CreateWorkspaceRequest>): Promise<Workspace | null> {
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

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await db.query(
      `UPDATE workspaces SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Delete workspace
  static async delete(id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM workspaces WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user is a member of the workspace
  static async isUserMember(workspace_id: string, user_id: string): Promise<WorkspaceMember | null> {
    const result = await db.query(
      'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspace_id, user_id]
    );

    return result.rows[0] || null;
  }

  // Add user to workspace
  static async addMember(workspace_id: string, user_id: string, role: string = 'member'): Promise<WorkspaceMember> {
    const result = await db.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (workspace_id, user_id)
       DO UPDATE SET role = $3, created_at = NOW()
       RETURNING *`,
      [workspace_id, user_id, role]
    );

    return result.rows[0];
  }

  // Remove user from workspace
  static async removeMember(workspace_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspace_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Get workspace members
  static async getMembers(workspace_id: string): Promise<(WorkspaceMember & { user: User })[]> {
    const result = await db.query(
      `SELECT wm.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user
       FROM workspace_members wm
       INNER JOIN users u ON wm.user_id = u.id
       WHERE wm.workspace_id = $1
       ORDER BY wm.created_at ASC`,
      [workspace_id]
    );

    return result.rows;
  }
}