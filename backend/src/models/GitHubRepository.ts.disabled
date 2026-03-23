import { db } from '../config/database';
import { GitHubRepository, CreateGitHubRepositoryRequest, UpdateGitHubRepositoryRequest } from './types';

export class GitHubRepositoryModel {
  // Create a new GitHub repository connection
  static async create(data: CreateGitHubRepositoryRequest): Promise<GitHubRepository> {
    // First, fetch repository metadata from the provided basic info
    // In a real implementation, we might call the GitHub API to get full details
    // For now, we'll use the provided data and reasonable defaults

    const full_name = `${data.owner}/${data.name}`;
    const url = `https://github.com/${full_name}`;
    const clone_url = `${url}.git`;
    const ssh_url = `git@github.com:${full_name}.git`;

    const result = await db.query(
      `INSERT INTO github_repositories (
        project_id, github_repo_id, owner, name, full_name, url, clone_url, ssh_url, access_level
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.project_id,
        data.github_repo_id,
        data.owner,
        data.name,
        full_name,
        url,
        clone_url,
        ssh_url,
        data.access_level || 'read'
      ]
    );

    return result.rows[0];
  }

  // Create a new GitHub repository connection with metadata from GitHub API
  static async createWithMetadata(
    data: CreateGitHubRepositoryRequest,
    metadata?: {
      description?: string;
      private?: boolean;
      default_branch?: string;
      language?: string;
      topics?: string[];
      clone_url?: string;
      ssh_url?: string;
      html_url?: string;
    }
  ): Promise<GitHubRepository> {
    const full_name = `${data.owner}/${data.name}`;

    // Use provided metadata or defaults
    const description = metadata?.description || null;
    const private_repo = metadata?.private || false;
    const default_branch = metadata?.default_branch || 'main';
    const language = metadata?.language || null;
    const topics = metadata?.topics || [];
    const clone_url = metadata?.clone_url || `https://github.com/${full_name}.git`;
    const ssh_url = metadata?.ssh_url || `git@github.com:${full_name}.git`;
    const url = metadata?.html_url || `https://github.com/${full_name}`;

    const result = await db.query(
      `INSERT INTO github_repositories (
        project_id, github_repo_id, owner, name, full_name, description, url, clone_url, ssh_url,
        private, default_branch, language, topics, access_level
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        data.project_id,
        data.github_repo_id,
        data.owner,
        data.name,
        full_name,
        description,
        url,
        clone_url,
        ssh_url,
        private_repo,
        default_branch,
        language,
        topics,
        data.access_level || 'read'
      ]
    );

    return result.rows[0];
  }

  // Get GitHub repository by ID
  static async findById(id: string): Promise<GitHubRepository | null> {
    const result = await db.query(
      'SELECT * FROM github_repositories WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get GitHub repository by project ID
  static async findByProjectId(project_id: string): Promise<GitHubRepository | null> {
    const result = await db.query(
      'SELECT * FROM github_repositories WHERE project_id = $1',
      [project_id]
    );

    return result.rows[0] || null;
  }

  // Get GitHub repository by GitHub repo ID
  static async findByGitHubRepoId(github_repo_id: number): Promise<GitHubRepository | null> {
    const result = await db.query(
      'SELECT * FROM github_repositories WHERE github_repo_id = $1',
      [github_repo_id]
    );

    return result.rows[0] || null;
  }

  // Get all GitHub repositories for a user (via project ownership)
  static async findByUserId(user_id: string): Promise<GitHubRepository[]> {
    const result = await db.query(
      `SELECT gr.* FROM github_repositories gr
       INNER JOIN projects p ON gr.project_id = p.id
       INNER JOIN workspaces w ON p.workspace_id = w.id
       INNER JOIN workspace_members wm ON w.id = wm.workspace_id
       WHERE wm.user_id = $1
       ORDER BY gr.updated_at DESC`,
      [user_id]
    );

    return result.rows;
  }

  // Update GitHub repository metadata
  static async update(id: string, data: UpdateGitHubRepositoryRequest): Promise<GitHubRepository | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.access_level !== undefined) {
      fields.push(`access_level = $${paramIndex++}`);
      values.push(data.access_level);
    }

    if (data.webhook_configured !== undefined) {
      fields.push(`webhook_configured = $${paramIndex++}`);
      values.push(data.webhook_configured);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await db.query(
      `UPDATE github_repositories SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Update repository metadata from GitHub API (for syncing)
  static async updateMetadata(
    id: string,
    metadata: {
      description?: string;
      private?: boolean;
      default_branch?: string;
      language?: string;
      topics?: string[];
    }
  ): Promise<GitHubRepository | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (metadata.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(metadata.description);
    }

    if (metadata.private !== undefined) {
      fields.push(`private = $${paramIndex++}`);
      values.push(metadata.private);
    }

    if (metadata.default_branch !== undefined) {
      fields.push(`default_branch = $${paramIndex++}`);
      values.push(metadata.default_branch);
    }

    if (metadata.language !== undefined) {
      fields.push(`language = $${paramIndex++}`);
      values.push(metadata.language);
    }

    if (metadata.topics !== undefined) {
      fields.push(`topics = $${paramIndex++}`);
      values.push(metadata.topics);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await db.query(
      `UPDATE github_repositories SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Delete GitHub repository connection
  static async delete(id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM github_repositories WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Delete GitHub repository connection by project ID
  static async deleteByProjectId(project_id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM github_repositories WHERE project_id = $1',
      [project_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if user can access GitHub repository (via project access)
  static async canUserAccess(repo_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM github_repositories gr
       INNER JOIN projects p ON gr.project_id = p.id
       INNER JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       WHERE gr.id = $1 AND wm.user_id = $2`,
      [repo_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if project already has a GitHub repository connected
  static async hasRepository(project_id: string): Promise<boolean> {
    const result = await db.query(
      'SELECT 1 FROM github_repositories WHERE project_id = $1',
      [project_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if GitHub repository is already connected to any project
  static async isRepositoryConnected(github_repo_id: number): Promise<boolean> {
    const result = await db.query(
      'SELECT 1 FROM github_repositories WHERE github_repo_id = $1',
      [github_repo_id]
    );

    return (result.rowCount ?? 0) > 0;
  }
}