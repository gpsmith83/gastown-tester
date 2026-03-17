/**
 * GitHub Service for repository content fetching
 * Implements B-604: Repository context ingestion job pipeline
 */

export interface GitHubFileContent {
  content: string;
  size: number;
  last_modified: Date;
  sha: string;
}

export interface GitHubRepositoryInfo {
  owner: string;
  repo: string;
  sha: string;
  default_branch: string;
  updated_at: Date;
}

export class GitHubService {
  private readonly GITHUB_API_BASE = 'https://api.github.com';

  constructor(private apiToken?: string) {
    this.apiToken = apiToken || process.env.GITHUB_TOKEN;
  }

  /**
   * Get repository information
   */
  async getRepositoryInfo(repoUrl: string): Promise<GitHubRepositoryInfo | null> {
    try {
      const { owner, repo } = this.parseGitHubUrl(repoUrl);

      const response = await this.makeGitHubRequest(`/repos/${owner}/${repo}`);
      if (!response) return null;

      return {
        owner,
        repo,
        sha: response.default_branch_sha || 'main', // Fallback to main
        default_branch: response.default_branch || 'main',
        updated_at: new Date(response.updated_at)
      };
    } catch (error) {
      console.error('Failed to get repository info:', error);
      return null;
    }
  }

  /**
   * Get file content from GitHub repository
   */
  async getFileContent(repoUrl: string, filePath: string, branch = 'main'): Promise<GitHubFileContent | null> {
    try {
      const { owner, repo } = this.parseGitHubUrl(repoUrl);

      const response = await this.makeGitHubRequest(`/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`);
      if (!response || !response.content) {
        console.warn(`File not found or empty: ${filePath}`);
        return null;
      }

      // GitHub API returns base64 encoded content
      const content = Buffer.from(response.content, 'base64').toString('utf-8');

      return {
        content,
        size: response.size || content.length,
        last_modified: new Date(), // GitHub doesn't return file modification time in contents API
        sha: response.sha
      };
    } catch (error) {
      console.error(`Failed to get file content for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Get directory contents (for discovering files)
   */
  async getDirectoryContents(repoUrl: string, dirPath = '', branch = 'main'): Promise<string[]> {
    try {
      const { owner, repo } = this.parseGitHubUrl(repoUrl);

      const response = await this.makeGitHubRequest(`/repos/${owner}/${repo}/contents/${dirPath}?ref=${branch}`);
      if (!response || !Array.isArray(response)) {
        return [];
      }

      return response
        .filter(item => item.type === 'file')
        .map(item => item.path);
    } catch (error) {
      console.error(`Failed to get directory contents for ${dirPath}:`, error);
      return [];
    }
  }

  /**
   * Parse GitHub URL to extract owner and repository name
   */
  private parseGitHubUrl(url: string): { owner: string; repo: string } {
    const patterns = [
      /github\.com[\/:]([^\/]+)\/([^\/\.]+)/,
      /git@github\.com:([^\/]+)\/([^\/\.]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, '')
        };
      }
    }

    throw new Error(`Invalid GitHub URL format: ${url}`);
  }

  /**
   * Make authenticated request to GitHub API
   */
  private async makeGitHubRequest(endpoint: string): Promise<any> {
    const url = `${this.GITHUB_API_BASE}${endpoint}`;

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Gastown-Tester-Worker/1.0'
    };

    // Add authentication if available
    if (this.apiToken) {
      headers['Authorization'] = `token ${this.apiToken}`;
    }

    try {
      const response = await fetch(url, { headers });

      if (response.status === 404) {
        console.warn(`GitHub API: Resource not found: ${endpoint}`);
        return null;
      }

      if (response.status === 403) {
        console.warn('GitHub API: Rate limited or access forbidden');
        throw new Error('GitHub API rate limit exceeded or access denied');
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to fetch from GitHub API: ${error}`);
    }
  }

  /**
   * Check if GitHub API is available and authenticated
   */
  async testConnection(): Promise<{ success: boolean; message: string; rate_limit?: any }> {
    try {
      const response = await this.makeGitHubRequest('/rate_limit');

      if (!response) {
        return {
          success: false,
          message: 'Failed to connect to GitHub API'
        };
      }

      return {
        success: true,
        message: this.apiToken ? 'Authenticated connection successful' : 'Unauthenticated connection successful',
        rate_limit: {
          remaining: response.rate?.remaining,
          limit: response.rate?.limit,
          reset: response.rate?.reset
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}