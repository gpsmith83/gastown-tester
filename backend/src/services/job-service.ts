import { generateJobId, JobLogger, appLogger, LogContext } from '../utils/logger';

export interface JobOptions {
  correlationId?: string;
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, any>;
}

export interface JobResult {
  jobId: string;
  success: boolean;
  result?: any;
  error?: string;
  duration?: number;
  correlationId?: string;
}

/**
 * Service for managing background jobs with correlation tracking
 */
export class JobService {
  private runningJobs = new Map<string, { startTime: number; logger: JobLogger }>();

  /**
   * Execute a background job with correlation tracking
   */
  async executeJob<T>(
    jobName: string,
    jobFunction: (jobLogger: JobLogger) => Promise<T>,
    options: JobOptions = {}
  ): Promise<JobResult> {
    const jobId = generateJobId();
    const startTime = Date.now();

    // Create job logger with correlation context
    const logger = new JobLogger('job-service', jobId);

    this.runningJobs.set(jobId, { startTime, logger });

    // Log job start
    logger.info(`Starting job: ${jobName}`, {
      operation: 'job_start',
      jobName,
      correlationId: options.correlationId,
      priority: options.priority || 'normal',
      metadata: options.metadata
    });

    try {
      // Execute the job function
      const result = await jobFunction(logger);
      const duration = Date.now() - startTime;

      // Log successful completion
      logger.info(`Job completed successfully: ${jobName}`, {
        operation: 'job_complete',
        jobName,
        duration,
        resultType: typeof result
      });

      this.runningJobs.delete(jobId);

      return {
        jobId,
        success: true,
        result,
        duration,
        correlationId: options.correlationId
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      // Log job failure
      logger.error(`Job failed: ${jobName}`, {
        operation: 'job_error',
        jobName,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      });

      this.runningJobs.delete(jobId);

      return {
        jobId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        correlationId: options.correlationId
      };
    }
  }

  /**
   * Get information about currently running jobs
   */
  getRunningJobs(): Array<{
    jobId: string;
    startTime: number;
    duration: number;
  }> {
    const now = Date.now();
    return Array.from(this.runningJobs.entries()).map(([jobId, info]) => ({
      jobId,
      startTime: info.startTime,
      duration: now - info.startTime
    }));
  }

  /**
   * Example background job: AI model health check
   */
  async scheduleAIHealthCheck(correlationId?: string): Promise<JobResult> {
    return this.executeJob(
      'ai_health_check',
      async (jobLogger) => {
        jobLogger.info('Performing scheduled AI provider health check', {
          operation: 'ai_health_monitoring'
        });

        // Simulate health check work
        await new Promise(resolve => setTimeout(resolve, 1000));

        const healthResult = {
          healthy: true,
          lastCheck: new Date().toISOString(),
          providersChecked: 1
        };

        jobLogger.info('AI health check completed', {
          operation: 'ai_health_monitoring',
          result: healthResult
        });

        return healthResult;
      },
      {
        correlationId,
        priority: 'normal',
        metadata: { type: 'scheduled_health_check' }
      }
    );
  }

  /**
   * Example background job: User data export
   */
  async exportUserData(userId: string, correlationId?: string): Promise<JobResult> {
    return this.executeJob(
      'user_data_export',
      async (jobLogger) => {
        jobLogger.info('Starting user data export', {
          operation: 'data_export',
          userId
        });

        // Simulate data export work
        jobLogger.info('Collecting user workspaces', {
          operation: 'data_export',
          userId,
          step: 'workspaces'
        });
        await new Promise(resolve => setTimeout(resolve, 500));

        jobLogger.info('Collecting user projects', {
          operation: 'data_export',
          userId,
          step: 'projects'
        });
        await new Promise(resolve => setTimeout(resolve, 300));

        jobLogger.info('Generating export file', {
          operation: 'data_export',
          userId,
          step: 'file_generation'
        });
        await new Promise(resolve => setTimeout(resolve, 200));

        const exportResult = {
          userId,
          exportedAt: new Date().toISOString(),
          recordsExported: {
            workspaces: 3,
            projects: 12,
            activities: 45
          },
          fileSize: '2.4MB'
        };

        jobLogger.info('User data export completed', {
          operation: 'data_export',
          userId,
          records: exportResult.recordsExported,
          fileSize: exportResult.fileSize
        });

        return exportResult;
      },
      {
        correlationId,
        priority: 'low', // Data exports are typically low priority
        metadata: { userId, type: 'data_export' }
      }
    );
  }
}

// Export singleton instance
export const jobService = new JobService();