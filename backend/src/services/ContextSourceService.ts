import {
  ContextSourceType,
  RecommendedContextSource,
  ContextSourceRecommendation,
  ProjectContextAnalysis
} from '../models/types';

/**
 * Service for analyzing GitHub repositories and recommending context sources
 * Implements B-603: Build context source recommendation and selection flow
 */
export class ContextSourceService {
  // Default context source types that we look for in repositories
  private static readonly DEFAULT_SOURCE_TYPES: ContextSourceType[] = [
    {
      id: 'readme',
      name: 'README Files',
      description: 'Main project documentation and getting started guides',
      pattern: 'README.*',
      priority: 1,
      category: 'documentation'
    },
    {
      id: 'docs',
      name: 'Documentation Directory',
      description: 'Dedicated documentation files and guides',
      pattern: 'docs/**/*',
      priority: 2,
      category: 'documentation'
    },
    {
      id: 'api-docs',
      name: 'API Documentation',
      description: 'API specifications, OpenAPI schemas, and endpoint docs',
      pattern: '{api,openapi,swagger}/**/*',
      priority: 2,
      category: 'documentation'
    },
    {
      id: 'changelog',
      name: 'Changelog & Release Notes',
      description: 'Version history and release information',
      pattern: '{CHANGELOG,HISTORY,RELEASES}.*',
      priority: 3,
      category: 'documentation'
    },
    {
      id: 'contributing',
      name: 'Contributing Guidelines',
      description: 'Development and contribution guidelines',
      pattern: '{CONTRIBUTING,DEVELOP,DEVELOPMENT}.*',
      priority: 3,
      category: 'documentation'
    },
    {
      id: 'config',
      name: 'Configuration Files',
      description: 'Package configs, build files, and project settings',
      pattern: '{package.json,*.config.js,*.config.ts,Cargo.toml,pom.xml,build.gradle}',
      priority: 4,
      category: 'config'
    },
    {
      id: 'examples',
      name: 'Example Code',
      description: 'Code examples and sample implementations',
      pattern: '{examples,samples}/**/*',
      priority: 4,
      category: 'code'
    }
  ];

  /**
   * Analyze a GitHub repository and recommend context sources
   */
  static async analyzeRepository(projectId: string, githubRepoUrl: string): Promise<ProjectContextAnalysis> {
    console.log(`Analyzing repository for project ${projectId}: ${githubRepoUrl}`);

    try {
      // Parse GitHub URL to extract owner/repo
      const { owner, repo } = this.parseGitHubUrl(githubRepoUrl);

      // For now, simulate repository analysis
      // In a real implementation, this would:
      // 1. Use GitHub API to fetch repository structure
      // 2. Scan files matching our patterns
      // 3. Analyze file contents for relevance
      // 4. Calculate confidence scores

      const recommendations = await this.generateMockRecommendations(owner, repo);

      return {
        project_id: projectId,
        github_repo_url: githubRepoUrl,
        analyzed_at: new Date(),
        total_files_scanned: recommendations.reduce((sum, r) => sum + r.files.length, 0),
        recommendations,
        analysis_status: 'completed'
      };
    } catch (error) {
      console.error('Failed to analyze repository:', error);
      return {
        project_id: projectId,
        github_repo_url: githubRepoUrl,
        analyzed_at: new Date(),
        total_files_scanned: 0,
        recommendations: [],
        analysis_status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Parse GitHub URL to extract owner and repository name
   */
  private static parseGitHubUrl(url: string): { owner: string; repo: string } {
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
   * Generate mock recommendations (replace with real GitHub API integration)
   */
  private static async generateMockRecommendations(owner: string, repo: string): Promise<ContextSourceRecommendation[]> {
    const recommendations: ContextSourceRecommendation[] = [];

    for (const sourceType of this.DEFAULT_SOURCE_TYPES) {
      const files = this.generateMockFilesForType(sourceType, owner, repo);

      if (files.length > 0) {
        const totalSize = files.reduce((sum, f) => sum + (f.file_size || 0), 0);

        recommendations.push({
          source_type: sourceType,
          files,
          total_size: totalSize,
          recommendation_summary: this.generateRecommendationSummary(sourceType, files)
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate mock files for a source type (replace with real GitHub API scan)
   */
  private static generateMockFilesForType(sourceType: ContextSourceType, owner: string, repo: string): RecommendedContextSource[] {
    const files: RecommendedContextSource[] = [];
    const projectId = 'mock-project-id'; // This would come from the actual analysis

    // Generate realistic mock files based on source type
    switch (sourceType.id) {
      case 'readme':
        files.push({
          id: `${projectId}-readme-1`,
          project_id: projectId,
          source_type_id: sourceType.id,
          file_path: 'README.md',
          file_size: 2456,
          last_modified: new Date('2024-03-15'),
          confidence_score: 95,
          is_recommended: true,
          recommendation_reason: 'Primary project documentation'
        });
        break;

      case 'docs':
        if (Math.random() > 0.3) { // 70% chance of having docs
          files.push(
            {
              id: `${projectId}-docs-1`,
              project_id: projectId,
              source_type_id: sourceType.id,
              file_path: 'docs/getting-started.md',
              file_size: 1823,
              confidence_score: 85,
              is_recommended: true,
              recommendation_reason: 'Getting started guide'
            },
            {
              id: `${projectId}-docs-2`,
              project_id: projectId,
              source_type_id: sourceType.id,
              file_path: 'docs/api-reference.md',
              file_size: 3456,
              confidence_score: 80,
              is_recommended: true,
              recommendation_reason: 'API documentation'
            }
          );
        }
        break;

      case 'config':
        files.push({
          id: `${projectId}-config-1`,
          project_id: projectId,
          source_type_id: sourceType.id,
          file_path: 'package.json',
          file_size: 512,
          confidence_score: 70,
          is_recommended: true,
          recommendation_reason: 'Project dependencies and scripts'
        });
        break;

      case 'changelog':
        if (Math.random() > 0.5) { // 50% chance of having changelog
          files.push({
            id: `${projectId}-changelog-1`,
            project_id: projectId,
            source_type_id: sourceType.id,
            file_path: 'CHANGELOG.md',
            file_size: 1234,
            confidence_score: 60,
            is_recommended: false,
            recommendation_reason: 'Version history for context'
          });
        }
        break;
    }

    return files;
  }

  /**
   * Generate a summary of recommendations for a source type
   */
  private static generateRecommendationSummary(sourceType: ContextSourceType, files: RecommendedContextSource[]): string {
    const recommendedCount = files.filter(f => f.is_recommended).length;
    const totalCount = files.length;

    if (recommendedCount === 0) {
      return `Found ${totalCount} ${sourceType.name.toLowerCase()} file(s), but none are strongly recommended.`;
    }

    if (recommendedCount === totalCount) {
      return `Found ${totalCount} ${sourceType.name.toLowerCase()} file(s), all recommended for context.`;
    }

    return `Found ${totalCount} ${sourceType.name.toLowerCase()} file(s), ${recommendedCount} recommended for context.`;
  }
}