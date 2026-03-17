import { db } from '../config/database';
import { User } from './types';

export interface CreateUserRequest {
  github_id: string;
  username: string;
  email: string;
  avatar_url?: string;
  name?: string;
}

export class UserModel {
  // Create or update user (for OAuth login)
  static async upsert(data: CreateUserRequest): Promise<User> {
    const result = await db.query(
      `INSERT INTO users (github_id, username, email, avatar_url, name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (github_id)
       DO UPDATE SET
         username = $2,
         email = $3,
         avatar_url = $4,
         name = $5,
         updated_at = NOW()
       RETURNING *`,
      [data.github_id, data.username, data.email, data.avatar_url, data.name]
    );

    return result.rows[0];
  }

  // Find user by ID
  static async findById(id: string): Promise<User | null> {
    const result = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Find user by GitHub ID
  static async findByGithubId(github_id: string): Promise<User | null> {
    const result = await db.query(
      'SELECT * FROM users WHERE github_id = $1',
      [github_id]
    );

    return result.rows[0] || null;
  }

  // Find user by email
  static async findByEmail(email: string): Promise<User | null> {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    return result.rows[0] || null;
  }

  // Update user profile
  static async update(id: string, data: Partial<CreateUserRequest>): Promise<User | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.username !== undefined) {
      fields.push(`username = $${paramIndex++}`);
      values.push(data.username);
    }

    if (data.email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      values.push(data.email);
    }

    if (data.avatar_url !== undefined) {
      fields.push(`avatar_url = $${paramIndex++}`);
      values.push(data.avatar_url);
    }

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await db.query(
      `UPDATE users SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Delete user
  static async delete(id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM users WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Get user's workspace and project counts
  static async getStats(id: string): Promise<{ workspace_count: number; project_count: number }> {
    const result = await db.query(
      `SELECT
         COALESCE(workspace_stats.count, 0) as workspace_count,
         COALESCE(project_stats.count, 0) as project_count
       FROM users u
       LEFT JOIN (
         SELECT wm.user_id, COUNT(*) as count
         FROM workspace_members wm
         WHERE wm.user_id = $1
         GROUP BY wm.user_id
       ) workspace_stats ON u.id = workspace_stats.user_id
       LEFT JOIN (
         SELECT p.owner_id, COUNT(*) as count
         FROM projects p
         WHERE p.owner_id = $1 AND p.status = 'active'
         GROUP BY p.owner_id
       ) project_stats ON u.id = project_stats.owner_id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return { workspace_count: 0, project_count: 0 };
    }

    return {
      workspace_count: parseInt(result.rows[0].workspace_count),
      project_count: parseInt(result.rows[0].project_count)
    };
  }
}