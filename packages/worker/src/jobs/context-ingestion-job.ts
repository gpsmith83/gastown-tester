import { JobData, JobResult, JobHandler } from '../job-queue';
import { GitHubService } from '../services/github-service';
import { ContextSnapshotService } from '../services/context-snapshot-service';

/**
 * Context Ingestion Job
 * Implements B-604: Repository context ingestion job pipeline
 *
 * Takes selected context sources and ingests them into processable context snapshots
 */

export interface ContextIngestionPayload {
  project_id: string;
  github_repo_url: string;
  selected_sources: {
    file_path: string;
    source_type_id: string;
    priority: number;
  }[];
  user_id: string;
  force_refresh?: boolean;
}

export interface ContextSnapshot {
  id: string;
  project_id: string;
  source_file_path: string;
  source_type_id: string;
  content_text: string;
  content_hash: string;
  file_size: number;
  last_modified: Date;
  ingested_at: Date;
  ingestion_metadata: {
    github_repo_url: string;
    github_sha?: string;
    parsing_method: string;
    word_count: number;
    char_count: number;
  };
}

export class ContextIngestionJob implements JobHandler {
  private githubService: GitHubService;
  private snapshotService: ContextSnapshotService;

  constructor() {
    this.githubService = new GitHubService();
    this.snapshotService = new ContextSnapshotService();
  }

  async process(job: JobData): Promise<JobResult> {
    const payload = job.payload as ContextIngestionPayload;

    console.log(`🔍 Starting context ingestion for project ${payload.project_id}`);
    console.log(`📂 Repository: ${payload.github_repo_url}`);
    console.log(`📄 Sources to ingest: ${payload.selected_sources.length}`);

    try {
      // Validate payload
      const validationError = this.validatePayload(payload);
      if (validationError) {
        return {
          success: false,
          error: `Payload validation failed: ${validationError}`,
          retry: false
        };
      }

      // Fetch repository information
      const repoInfo = await this.githubService.getRepositoryInfo(payload.github_repo_url);
      if (!repoInfo) {
        return {
          success: false,
          error: 'Failed to fetch repository information',
          retry: true,
          retry_delay: 5000
        };
      }

      // Process each selected source
      const snapshots: ContextSnapshot[] = [];
      const errors: string[] = [];

      for (const source of payload.selected_sources) {
        try {
          console.log(`📥 Ingesting: ${source.file_path}`);
          const snapshot = await this.ingestSource(payload, source, repoInfo);

          if (snapshot) {
            snapshots.push(snapshot);
            console.log(`✅ Ingested: ${source.file_path} (${snapshot.content_text.length} chars)`);
          } else {
            errors.push(`Failed to ingest ${source.file_path}: No content returned`);
          }
        } catch (error) {
          const errorMsg = `Failed to ingest ${source.file_path}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // Store the snapshots
      if (snapshots.length > 0) {
        await this.snapshotService.saveSnapshots(payload.project_id, snapshots);
        console.log(`💾 Saved ${snapshots.length} context snapshots for project ${payload.project_id}`);
      }

      // Return result
      const result = {
        snapshots_created: snapshots.length,
        total_sources: payload.selected_sources.length,
        errors: errors.length > 0 ? errors : undefined,
        ingested_at: new Date(),
        repository: {
          url: payload.github_repo_url,
          sha: repoInfo.sha
        }
      };

      if (errors.length > 0 && snapshots.length === 0) {
        // All sources failed
        return {
          success: false,
          error: `All sources failed to ingest: ${errors.join('; ')}`,
          result,
          retry: true,
          retry_delay: 10000
        };
      } else {
        // Partial or full success
        return {
          success: true,
          result
        };
      }

    } catch (error) {
      console.error(`❌ Context ingestion job failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retry: true,
        retry_delay: 30000
      };
    }
  }

  /**
   * Validate the job payload
   */
  private validatePayload(payload: ContextIngestionPayload): string | null {
    if (!payload.project_id) return 'project_id is required';
    if (!payload.github_repo_url) return 'github_repo_url is required';
    if (!payload.user_id) return 'user_id is required';
    if (!payload.selected_sources || !Array.isArray(payload.selected_sources)) {
      return 'selected_sources must be an array';
    }
    if (payload.selected_sources.length === 0) {
      return 'At least one selected source is required';
    }

    // Validate each source
    for (const source of payload.selected_sources) {
      if (!source.file_path) return 'Each source must have a file_path';
      if (!source.source_type_id) return 'Each source must have a source_type_id';
    }

    return null;
  }

  /**
   * Ingest a single source file
   */
  private async ingestSource(
    payload: ContextIngestionPayload,
    source: { file_path: string; source_type_id: string; priority: number },
    repoInfo: any
  ): Promise<ContextSnapshot | null> {
    // Fetch file content from GitHub
    const fileContent = await this.githubService.getFileContent(
      payload.github_repo_url,
      source.file_path
    );

    if (!fileContent) {
      throw new Error(`File not found or empty: ${source.file_path}`);
    }

    // Parse the content based on file type
    const parsedContent = this.parseFileContent(source.file_path, fileContent.content);

    // Create content hash for deduplication
    const contentHash = this.createContentHash(parsedContent);

    // Create snapshot
    const snapshot: ContextSnapshot = {
      id: this.generateSnapshotId(),
      project_id: payload.project_id,
      source_file_path: source.file_path,
      source_type_id: source.source_type_id,
      content_text: parsedContent,
      content_hash: contentHash,
      file_size: fileContent.size,
      last_modified: fileContent.last_modified,
      ingested_at: new Date(),
      ingestion_metadata: {
        github_repo_url: payload.github_repo_url,
        github_sha: repoInfo.sha,
        parsing_method: this.getParsingMethod(source.file_path),
        word_count: parsedContent.split(/\s+/).length,
        char_count: parsedContent.length
      }
    };

    return snapshot;
  }

  /**
   * Parse file content based on file type
   */
  private parseFileContent(filePath: string, content: string): string {
    const ext = filePath.toLowerCase().split('.').pop() || '';

    switch (ext) {
      case 'md':
      case 'markdown':
        return this.parseMarkdown(content);
      case 'json':
        return this.parseJson(content);
      case 'txt':
      case 'text':
        return content.trim();
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return this.parseCode(content);
      default:
        // Default to plain text parsing
        return content.trim();
    }
  }

  /**
   * Parse Markdown content
   */
  private parseMarkdown(content: string): string {
    // For now, just clean up the markdown but keep it readable
    return content
      .trim()
      .replace(/<!--.*?-->/gs, '') // Remove HTML comments
      .replace(/^\s*```[\s\S]*?```\s*$/gm, '[CODE BLOCK]') // Replace code blocks with placeholders
      .replace(/\n{3,}/g, '\n\n'); // Normalize whitespace
  }

  /**
   * Parse JSON content
   */
  private parseJson(content: string): string {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content.trim();
    }
  }

  /**
   * Parse code content
   */
  private parseCode(content: string): string {
    // For code files, just clean up whitespace and remove excessive comments
    return content
      .trim()
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/\n{3,}/g, '\n\n'); // Normalize whitespace
  }

  /**
   * Get parsing method name for metadata
   */
  private getParsingMethod(filePath: string): string {
    const ext = filePath.toLowerCase().split('.').pop() || '';

    switch (ext) {
      case 'md':
      case 'markdown':
        return 'markdown';
      case 'json':
        return 'json';
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return 'code';
      default:
        return 'plaintext';
    }
  }

  /**
   * Create a hash of the content for deduplication
   */
  private createContentHash(content: string): string {
    // Simple hash function (in production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Generate a unique snapshot ID
   */
  private generateSnapshotId(): string {
    return `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}