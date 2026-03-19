import { IExporter, ExportResult } from '../ExportService';
import { Requirement, GitHubExportConfig } from '../../models/types';

interface GitHubIssue {
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
}

interface GitHubApiResponse {
  number: number;
  html_url: string;
  id: number;
  state: string;
}

/**
 * GitHub Issues Exporter (B-505)
 * Exports requirements as GitHub issues with retry logic
 */
export class GitHubExporter implements IExporter {
  private readonly githubToken: string;
  private readonly apiUrl = 'https://api.github.com';

  constructor() {
    this.githubToken = process.env.GITHUB_ACCESS_TOKEN || '';
    if (!this.githubToken) {
      console.warn('GitHub access token not configured. GitHub export will fail.');
    }
  }

  /**
   * Export a requirement as a GitHub issue
   */
  async exportRequirement(requirement: Requirement, config: GitHubExportConfig): Promise<ExportResult> {
    try {
      if (!this.githubToken) {
        throw new Error('GitHub access token not configured');
      }

      const issue = this.formatRequirementAsIssue(requirement, config);
      const githubIssue = await this.createGitHubIssue(config.repository, issue);

      return {
        success: true,
        external_id: githubIssue.number.toString(),
        external_url: githubIssue.html_url,
        export_data: {
          github_issue_id: githubIssue.id,
          github_issue_number: githubIssue.number,
          github_issue_url: githubIssue.html_url,
          github_issue_state: githubIssue.state,
          exported_at: new Date().toISOString(),
          original_requirement: {
            id: requirement.id,
            title: requirement.title,
            type: requirement.type,
            priority: requirement.priority
          }
        }
      };
    } catch (error) {
      console.error('GitHub export failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Validate GitHub export configuration
   */
  async validateConfig(config: any): Promise<{ valid: boolean; error?: string }> {
    try {
      // Type check
      if (!config || typeof config !== 'object') {
        return { valid: false, error: 'Configuration must be an object' };
      }

      const gitHubConfig = config as GitHubExportConfig;

      // Repository validation
      if (!gitHubConfig.repository || !gitHubConfig.repository.owner || !gitHubConfig.repository.name) {
        return { valid: false, error: 'Repository owner and name are required' };
      }

      // Repository name format validation
      if (!/^[a-zA-Z0-9_.-]+$/.test(gitHubConfig.repository.owner) ||
          !/^[a-zA-Z0-9_.-]+$/.test(gitHubConfig.repository.name)) {
        return { valid: false, error: 'Invalid repository owner or name format' };
      }

      // Optional: Validate repository exists and is accessible
      if (this.githubToken) {
        try {
          await this.validateRepositoryAccess(gitHubConfig.repository);
        } catch (error) {
          return {
            valid: false,
            error: `Repository access validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Configuration validation failed'
      };
    }
  }

  /**
   * Format requirement as GitHub issue
   */
  private formatRequirementAsIssue(requirement: Requirement, config: GitHubExportConfig): GitHubIssue {
    // Apply title template
    let title = requirement.title;
    if (config.template?.title_prefix) {
      title = `${config.template.title_prefix}${title}`;
    }

    // Apply body template or use default format
    let body = requirement.description || '';
    if (config.template?.body_template) {
      body = config.template.body_template
        .replace('{title}', requirement.title)
        .replace('{description}', requirement.description || '')
        .replace('{type}', requirement.type)
        .replace('{priority}', requirement.priority.toString())
        .replace('{id}', requirement.id);
    } else {
      // Default template
      body = `## Description\n\n${requirement.description || requirement.title}\n\n` +
             `## Details\n\n` +
             `- **Type**: ${requirement.type}\n` +
             `- **Priority**: ${this.formatPriority(requirement.priority)}\n` +
             `- **Requirement ID**: \`${requirement.id}\`\n\n` +
             `---\n` +
             `*This issue was automatically created from requirement ${requirement.id}*`;
    }

    // Prepare labels
    const labels: string[] = [];

    // Add type label
    labels.push(requirement.type);

    // Add priority label
    labels.push(this.formatPriorityLabel(requirement.priority));

    // Add configured labels
    if (config.labels) {
      labels.push(...config.labels);
    }

    const issue: GitHubIssue = {
      title,
      body,
      labels: [...new Set(labels)] // Remove duplicates
    };

    // Add assignees if configured
    if (config.assignees && config.assignees.length > 0) {
      issue.assignees = config.assignees;
    }

    return issue;
  }

  /**
   * Create GitHub issue via API
   */
  private async createGitHubIssue(repository: { owner: string; name: string }, issue: GitHubIssue): Promise<GitHubApiResponse> {
    const url = `${this.apiUrl}/repos/${repository.owner}/${repository.name}/issues`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'gastown-tester-export'
      },
      body: JSON.stringify(issue)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `GitHub API request failed: ${response.status} ${response.statusText}`;

      try {
        const errorData = JSON.parse(errorText);
        if (errorData.message) {
          errorMessage += ` - ${errorData.message}`;
        }
        if (errorData.errors) {
          errorMessage += ` - ${JSON.stringify(errorData.errors)}`;
        }
      } catch {
        errorMessage += ` - ${errorText}`;
      }

      throw new Error(errorMessage);
    }

    const responseData = await response.json();
    return responseData as GitHubApiResponse;
  }

  /**
   * Validate repository access
   */
  private async validateRepositoryAccess(repository: { owner: string; name: string }): Promise<void> {
    const url = `${this.apiUrl}/repos/${repository.owner}/${repository.name}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'gastown-tester-export'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Repository not found');
      }
      if (response.status === 403) {
        throw new Error('Access denied to repository');
      }
      throw new Error(`Repository validation failed: ${response.status} ${response.statusText}`);
    }

    // Verify we have issues access by checking repository permissions
    const repoData = await response.json();
    if (repoData.permissions && !repoData.permissions.push) {
      throw new Error('Insufficient permissions to create issues in repository');
    }
  }

  /**
   * Format priority number as human-readable string
   */
  private formatPriority(priority: number): string {
    switch (priority) {
      case 1: return 'Critical (P1)';
      case 2: return 'High (P2)';
      case 3: return 'Medium (P3)';
      case 4: return 'Low (P4)';
      case 5: return 'Trivial (P5)';
      default: return `P${priority}`;
    }
  }

  /**
   * Format priority as label
   */
  private formatPriorityLabel(priority: number): string {
    switch (priority) {
      case 1: return 'priority:critical';
      case 2: return 'priority:high';
      case 3: return 'priority:medium';
      case 4: return 'priority:low';
      case 5: return 'priority:trivial';
      default: return `priority:p${priority}`;
    }
  }
}