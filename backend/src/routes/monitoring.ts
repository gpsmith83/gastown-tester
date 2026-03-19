import { Router, Request, Response } from 'express';
import { MonitoringMetricsModel, MetricsFilter } from '../models/MonitoringMetrics';
import { MonitoringService } from '../services/monitoringService';
import { getCurrentSystemMetrics } from '../middleware/performanceMonitoring';
import { apiLogger } from '../utils/logger';

const router = Router();

/**
 * GET /api/monitoring/dashboard
 * Get comprehensive dashboard metrics
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  const logger = apiLogger.withRequest(req);

  try {
    const timeRange = (req.query.timeRange as '1h' | '24h' | '7d') || '24h';

    logger.info('Fetching dashboard metrics', {
      operation: 'get_dashboard_metrics',
      timeRange
    });

    const dashboard = await MonitoringService.getDashboardMetrics(timeRange);

    res.json({
      success: true,
      data: dashboard,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to fetch dashboard metrics', {
      operation: 'get_dashboard_metrics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/monitoring/health
 * Get system health status
 */
router.get('/health', async (req: Request, res: Response) => {
  const logger = apiLogger.withRequest(req);

  try {
    logger.info('Fetching system health', {
      operation: 'get_system_health'
    });

    const health = await MonitoringService.getSystemHealth();

    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to fetch system health', {
      operation: 'get_system_health',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch system health',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/monitoring/metrics
 * Get raw metrics with filtering and pagination
 */
router.get('/metrics', async (req: Request, res: Response) => {
  const logger = apiLogger.withRequest(req);

  try {
    const {
      startDate,
      endDate,
      path,
      method,
      statusCode,
      userId,
      isError,
      limit = 100,
      offset = 0
    } = req.query;

    const filter: MetricsFilter = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      path: path as string,
      method: method as string,
      statusCode: statusCode ? parseInt(statusCode as string) : undefined,
      userId: userId as string,
      isError: isError ? isError === 'true' : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    };

    logger.info('Fetching metrics with filter', {
      operation: 'get_metrics',
      filter: {
        ...filter,
        startDate: filter.startDate?.toISOString(),
        endDate: filter.endDate?.toISOString()
      }
    });

    const metrics = await MonitoringMetricsModel.getMetrics(filter);

    res.json({
      success: true,
      data: metrics,
      pagination: {
        limit: filter.limit,
        offset: filter.offset,
        count: metrics.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to fetch metrics', {
      operation: 'get_metrics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/monitoring/summary
 * Get metrics summary and analytics
 */
router.get('/summary', async (req: Request, res: Response) => {
  const logger = apiLogger.withRequest(req);

  try {
    const {
      startDate,
      endDate,
      path,
      method,
      statusCode,
      userId,
      isError
    } = req.query;

    const filter: MetricsFilter = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      path: path as string,
      method: method as string,
      statusCode: statusCode ? parseInt(statusCode as string) : undefined,
      userId: userId as string,
      isError: isError ? isError === 'true' : undefined
    };

    logger.info('Fetching metrics summary', {
      operation: 'get_metrics_summary',
      filter: {
        ...filter,
        startDate: filter.startDate?.toISOString(),
        endDate: filter.endDate?.toISOString()
      }
    });

    const summary = await MonitoringMetricsModel.getMetricsSummary(filter);

    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to fetch metrics summary', {
      operation: 'get_metrics_summary',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics summary',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/monitoring/alerts
 * Get current performance alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  const logger = apiLogger.withRequest(req);

  try {
    logger.info('Fetching performance alerts', {
      operation: 'get_performance_alerts'
    });

    const alerts = await MonitoringService.getPerformanceAlerts();

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to fetch performance alerts', {
      operation: 'get_performance_alerts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance alerts',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/monitoring/system
 * Get current system metrics snapshot
 */
router.get('/system', (req: Request, res: Response) => {
  const logger = apiLogger.withRequest(req);

  try {
    logger.info('Fetching system metrics', {
      operation: 'get_system_metrics'
    });

    const systemMetrics = getCurrentSystemMetrics();

    res.json({
      success: true,
      data: systemMetrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to fetch system metrics', {
      operation: 'get_system_metrics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch system metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/monitoring/error-hotspots
 * Get endpoints with highest error rates
 */
router.get('/error-hotspots', async (req: Request, res: Response) => {
  const logger = apiLogger.withRequest(req);

  try {
    const timeRange = (req.query.timeRange as '1h' | '24h' | '7d') || '24h';

    logger.info('Fetching error hotspots', {
      operation: 'get_error_hotspots',
      timeRange
    });

    const hotspots = await MonitoringService.getErrorHotspots(timeRange);

    res.json({
      success: true,
      data: hotspots,
      timeRange,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to fetch error hotspots', {
      operation: 'get_error_hotspots',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch error hotspots',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/monitoring/cleanup
 * Clean up old metrics (admin endpoint)
 */
router.post('/cleanup', async (req: Request, res: Response) => {
  const logger = apiLogger.withRequest(req);

  try {
    const { retentionDays = 90 } = req.body;

    logger.info('Starting metrics cleanup', {
      operation: 'cleanup_metrics',
      retentionDays
    });

    const deletedCount = await MonitoringService.cleanupOldMetrics(retentionDays);

    logger.info('Metrics cleanup completed', {
      operation: 'cleanup_metrics',
      deletedCount,
      retentionDays
    });

    res.json({
      success: true,
      data: {
        deletedCount,
        retentionDays
      },
      message: `Cleaned up ${deletedCount} old metrics`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to cleanup metrics', {
      operation: 'cleanup_metrics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to cleanup metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/monitoring
 * Get monitoring API info and available endpoints
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Monitoring API',
    version: '1.0.0',
    endpoints: {
      dashboard: '/api/monitoring/dashboard',
      health: '/api/monitoring/health',
      metrics: '/api/monitoring/metrics',
      summary: '/api/monitoring/summary',
      alerts: '/api/monitoring/alerts',
      system: '/api/monitoring/system',
      errorHotspots: '/api/monitoring/error-hotspots',
      cleanup: '/api/monitoring/cleanup'
    },
    description: 'Performance monitoring and metrics collection API',
    timestamp: new Date().toISOString()
  });
});

export default router;