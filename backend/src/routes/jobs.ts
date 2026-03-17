import express, { Request, Response } from 'express';
import { jobService } from '../services/job-service';
import { apiLogger } from '../utils/logger';

const router = express.Router();

/**
 * POST /jobs/health-check
 * Trigger an AI health check job
 */
router.post('/health-check', async (req: Request, res: Response) => {
  const logger = apiLogger.withRequest(req);

  try {
    logger.info('Triggering background AI health check', {
      operation: 'trigger_health_check_job'
    });

    // Trigger background job with request correlation ID
    const jobResult = await jobService.scheduleAIHealthCheck(req.correlationId);

    logger.info('Health check job completed', {
      operation: 'trigger_health_check_job',
      jobId: jobResult.jobId,
      success: jobResult.success,
      duration: jobResult.duration
    });

    res.json({
      message: 'Health check job completed',
      job: {
        id: jobResult.jobId,
        success: jobResult.success,
        duration: jobResult.duration,
        result: jobResult.result
      },
      correlationId: req.correlationId
    });

  } catch (error) {
    logger.error('Failed to trigger health check job', {
      operation: 'trigger_health_check_job',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Failed to trigger health check job',
      message: error instanceof Error ? error.message : 'Unknown error',
      correlationId: req.correlationId
    });
  }
});

/**
 * POST /jobs/export-user-data
 * Trigger a user data export job
 */
router.post('/export-user-data', async (req: Request, res: Response) => {
  const logger = apiLogger.withRequest(req);

  try {
    const { userId } = req.body;

    if (!userId) {
      logger.warn('User data export requested without userId', {
        operation: 'trigger_export_job',
        validationError: 'userId_required'
      });
      return res.status(400).json({
        error: 'userId is required',
        correlationId: req.correlationId
      });
    }

    logger.info('Triggering user data export job', {
      operation: 'trigger_export_job',
      userId
    });

    // Trigger background job with request correlation ID
    const jobResult = await jobService.exportUserData(userId, req.correlationId);

    logger.info('User data export job completed', {
      operation: 'trigger_export_job',
      jobId: jobResult.jobId,
      userId,
      success: jobResult.success,
      duration: jobResult.duration
    });

    res.json({
      message: 'User data export job completed',
      job: {
        id: jobResult.jobId,
        success: jobResult.success,
        duration: jobResult.duration,
        result: jobResult.result
      },
      correlationId: req.correlationId
    });

  } catch (error) {
    logger.error('Failed to trigger user data export job', {
      operation: 'trigger_export_job',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Failed to trigger user data export job',
      message: error instanceof Error ? error.message : 'Unknown error',
      correlationId: req.correlationId
    });
  }
});

/**
 * GET /jobs/running
 * Get information about currently running jobs
 */
router.get('/running', async (req: Request, res: Response) => {
  const logger = apiLogger.withRequest(req);

  try {
    logger.info('Fetching running jobs status', { operation: 'get_running_jobs' });

    const runningJobs = jobService.getRunningJobs();

    logger.info('Running jobs status retrieved', {
      operation: 'get_running_jobs',
      jobCount: runningJobs.length
    });

    res.json({
      runningJobs,
      count: runningJobs.length,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId
    });

  } catch (error) {
    logger.error('Failed to get running jobs', {
      operation: 'get_running_jobs',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Failed to get running jobs',
      message: error instanceof Error ? error.message : 'Unknown error',
      correlationId: req.correlationId
    });
  }
});

export default router;