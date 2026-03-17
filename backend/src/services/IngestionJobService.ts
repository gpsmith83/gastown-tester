/**
 * Ingestion Job Service for triggering repository context ingestion jobs
 * Implements B-604: Repository context ingestion job pipeline
 *
 * This service acts as a bridge between the backend API and the worker queue
 */

export interface IngestionJobRequest {
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

export interface IngestionJobStatus {
  job_id: string;
  project_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
  error_message?: string;
  result?: any;
}

/**
 * Service for managing repository context ingestion jobs
 * In production, this would integrate with the actual worker queue
 */
export class IngestionJobService {
  // In-memory job tracking for MVP - in production, use Redis or database
  private static jobs: Map<string, IngestionJobStatus> = new Map();

  /**
   * Start a repository context ingestion job
   */
  static async startIngestionJob(request: IngestionJobRequest): Promise<string> {
    console.log(`🚀 Starting ingestion job for project ${request.project_id}`);

    // Generate job ID
    const jobId = this.generateJobId();

    // Create job status record
    const jobStatus: IngestionJobStatus = {
      job_id: jobId,
      project_id: request.project_id,
      status: 'pending',
      created_at: new Date()
    };

    this.jobs.set(jobId, jobStatus);

    // For MVP, simulate job processing
    // In production, this would enqueue the job to the worker queue
    this.simulateJobProcessing(jobId, request);

    console.log(`✅ Ingestion job ${jobId} queued for project ${request.project_id}`);
    return jobId;
  }

  /**
   * Get job status by ID
   */
  static async getJobStatus(jobId: string): Promise<IngestionJobStatus | null> {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get all jobs for a project
   */
  static async getProjectJobs(projectId: string): Promise<IngestionJobStatus[]> {
    const projectJobs: IngestionJobStatus[] = [];

    for (const job of this.jobs.values()) {
      if (job.project_id === projectId) {
        projectJobs.push(job);
      }
    }

    // Sort by creation time, newest first
    return projectJobs.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  /**
   * Get recent jobs across all projects
   */
  static async getRecentJobs(limit = 50): Promise<IngestionJobStatus[]> {
    const allJobs = Array.from(this.jobs.values());

    return allJobs
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, limit);
  }

  /**
   * Cancel a pending job
   */
  static async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);

    if (!job) {
      return false;
    }

    if (job.status !== 'pending') {
      throw new Error(`Cannot cancel job ${jobId}: status is ${job.status}`);
    }

    // For MVP, just mark as failed
    job.status = 'failed';
    job.error_message = 'Job cancelled by user';
    job.completed_at = new Date();

    this.jobs.set(jobId, job);

    console.log(`❌ Cancelled job ${jobId}`);
    return true;
  }

  /**
   * Clean up old completed jobs
   */
  static async cleanupOldJobs(olderThanHours = 24): Promise<number> {
    const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    let deletedCount = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.completed_at && job.completed_at < cutoffTime) {
        this.jobs.delete(jobId);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`🧹 Cleaned up ${deletedCount} old jobs older than ${olderThanHours} hours`);
    }

    return deletedCount;
  }

  /**
   * Simulate job processing for MVP
   * In production, this logic would be in the worker queue
   */
  private static async simulateJobProcessing(jobId: string, request: IngestionJobRequest) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // Simulate async processing
    setTimeout(async () => {
      try {
        // Mark as processing
        job.status = 'processing';
        job.started_at = new Date();
        this.jobs.set(jobId, job);

        console.log(`⚙️ Processing ingestion job ${jobId}...`);

        // Simulate processing time based on number of sources
        const processingTime = Math.min(request.selected_sources.length * 1000 + 2000, 10000);
        await new Promise(resolve => setTimeout(resolve, processingTime));

        // Simulate success/failure (90% success rate)
        const success = Math.random() > 0.1;

        if (success) {
          // Mark as completed
          job.status = 'completed';
          job.completed_at = new Date();
          job.result = {
            snapshots_created: request.selected_sources.length,
            total_sources: request.selected_sources.length,
            ingested_at: new Date(),
            repository: {
              url: request.github_repo_url,
              sha: 'mock-sha-' + Math.random().toString(36).substr(2, 8)
            }
          };

          console.log(`✅ Ingestion job ${jobId} completed successfully`);
        } else {
          // Mark as failed
          job.status = 'failed';
          job.completed_at = new Date();
          job.error_message = 'Simulated failure: GitHub API rate limit exceeded';

          console.log(`❌ Ingestion job ${jobId} failed: ${job.error_message}`);
        }

        this.jobs.set(jobId, job);

      } catch (error) {
        // Handle unexpected errors
        job.status = 'failed';
        job.completed_at = new Date();
        job.error_message = error instanceof Error ? error.message : 'Unknown error occurred';

        this.jobs.set(jobId, job);

        console.error(`❌ Ingestion job ${jobId} failed with error:`, error);
      }
    }, 1000); // Start processing after 1 second
  }

  /**
   * Generate a unique job ID
   */
  private static generateJobId(): string {
    return `ingest-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  }

  /**
   * Get ingestion job statistics
   */
  static async getJobStatistics(): Promise<{
    total_jobs: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    success_rate: number;
  }> {
    const stats = {
      total_jobs: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      success_rate: 0
    };

    for (const job of this.jobs.values()) {
      stats.total_jobs++;

      switch (job.status) {
        case 'pending':
          stats.pending++;
          break;
        case 'processing':
          stats.processing++;
          break;
        case 'completed':
          stats.completed++;
          break;
        case 'failed':
          stats.failed++;
          break;
      }
    }

    // Calculate success rate
    const finishedJobs = stats.completed + stats.failed;
    if (finishedJobs > 0) {
      stats.success_rate = Math.round((stats.completed / finishedJobs) * 100);
    }

    return stats;
  }
}