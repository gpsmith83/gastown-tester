import { MonitoringMetricsModel, MetricsSummary, MetricsFilter, MonitoringMetric } from '../models/MonitoringMetrics';
import { appLogger } from '../utils/logger';
import { getCurrentSystemMetrics } from '../middleware/performanceMonitoring';

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  uptime: number;
  version: string;
  database: 'connected' | 'unavailable';
  systemMetrics: {
    memoryUsageMb: number;
    cpuUsagePercent: number | null;
    processId: number;
  };
  performanceMetrics: {
    avgResponseTime24h: number;
    errorRate24h: number;
    requestCount24h: number;
  };
}

export interface DashboardMetrics {
  summary: MetricsSummary;
  systemHealth: HealthStatus;
  recentMetrics: MonitoringMetric[];
  trends: {
    hourlyRequestCounts: { hour: string; count: number }[];
    hourlyErrorRates: { hour: string; errorRate: number }[];
    hourlyResponseTimes: { hour: string; avgResponseTime: number }[];
  };
}

/**
 * Service for aggregating and providing monitoring metrics
 */
export class MonitoringService {

  /**
   * Get comprehensive dashboard metrics
   */
  static async getDashboardMetrics(timeRange: '1h' | '24h' | '7d' = '24h'): Promise<DashboardMetrics> {
    const logger = appLogger.withJob('get-dashboard-metrics');

    try {
      logger.info('Generating dashboard metrics', { timeRange });

      const startDate = this.getStartDateForRange(timeRange);
      const filter: MetricsFilter = { startDate };

      // Get summary metrics
      const summary = await MonitoringMetricsModel.getMetricsSummary(filter);

      // Get system health
      const systemHealth = await this.getSystemHealth();

      // Get recent metrics
      const recentMetrics = await MonitoringMetricsModel.getMetrics({
        ...filter,
        limit: 20
      });

      // Get trends
      const trends = await this.getTrends(startDate);

      const dashboard: DashboardMetrics = {
        summary,
        systemHealth,
        recentMetrics,
        trends
      };

      logger.info('Dashboard metrics generated successfully', {
        timeRange,
        requestCount: summary.requestCount,
        errorRate: summary.errorRate
      });

      return dashboard;

    } catch (error) {
      logger.error('Failed to generate dashboard metrics', {
        timeRange,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get system health status
   */
  static async getSystemHealth(): Promise<HealthStatus> {
    const logger = appLogger.withJob('get-system-health');

    try {
      // Get current system metrics
      const systemMetrics = getCurrentSystemMetrics();

      // Get 24h performance metrics
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - 24);

      const performanceSummary = await MonitoringMetricsModel.getMetricsSummary({
        startDate
      });

      // Determine health status based on metrics
      let status: HealthStatus['status'] = 'healthy';

      // Warning conditions
      if (performanceSummary.errorRate > 5 || performanceSummary.avgResponseTime > 2000) {
        status = 'warning';
      }

      // Critical conditions
      if (performanceSummary.errorRate > 15 || performanceSummary.avgResponseTime > 5000) {
        status = 'critical';
      }

      // Memory usage warnings
      if (systemMetrics.memoryUsageMb > 500) {
        status = status === 'healthy' ? 'warning' : status;
      }

      if (systemMetrics.memoryUsageMb > 1000) {
        status = 'critical';
      }

      const health: HealthStatus = {
        status,
        timestamp: new Date().toISOString(),
        uptime: systemMetrics.uptime,
        version: process.env.npm_package_version || '1.0.0',
        database: 'connected', // This should be enhanced to actually check DB status
        systemMetrics: {
          memoryUsageMb: systemMetrics.memoryUsageMb,
          cpuUsagePercent: systemMetrics.cpuUsagePercent,
          processId: systemMetrics.processId
        },
        performanceMetrics: {
          avgResponseTime24h: performanceSummary.avgResponseTime,
          errorRate24h: performanceSummary.errorRate,
          requestCount24h: performanceSummary.requestCount
        }
      };

      logger.info('System health status generated', {
        status,
        errorRate24h: performanceSummary.errorRate,
        avgResponseTime24h: performanceSummary.avgResponseTime,
        memoryUsageMb: systemMetrics.memoryUsageMb
      });

      return health;

    } catch (error) {
      logger.error('Failed to get system health', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Return critical status if we can't determine health
      return {
        status: 'critical',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        database: 'unavailable',
        systemMetrics: getCurrentSystemMetrics(),
        performanceMetrics: {
          avgResponseTime24h: 0,
          errorRate24h: 0,
          requestCount24h: 0
        }
      };
    }
  }

  /**
   * Get performance trends over time
   */
  static async getTrends(startDate: Date) {
    const logger = appLogger.withJob('get-performance-trends');

    try {
      // For now, return empty trends - this could be enhanced with time-series data
      // In a production system, you'd want to use time-bucketed queries
      const trends = {
        hourlyRequestCounts: [] as { hour: string; count: number }[],
        hourlyErrorRates: [] as { hour: string; errorRate: number }[],
        hourlyResponseTimes: [] as { hour: string; avgResponseTime: number }[]
      };

      logger.debug('Trends data generated (placeholder)', {
        startDate: startDate.toISOString()
      });

      return trends;

    } catch (error) {
      logger.error('Failed to get performance trends', {
        startDate: startDate.toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Return empty trends on error
      return {
        hourlyRequestCounts: [],
        hourlyErrorRates: [],
        hourlyResponseTimes: []
      };
    }
  }

  /**
   * Get endpoints with highest error rates
   */
  static async getErrorHotspots(timeRange: '1h' | '24h' | '7d' = '24h'): Promise<{
    path: string;
    errorCount: number;
    totalRequests: number;
    errorRate: number;
  }[]> {
    const logger = appLogger.withJob('get-error-hotspots');

    try {
      const startDate = this.getStartDateForRange(timeRange);

      // This would require a more complex query, for now return empty array
      logger.info('Error hotspots analysis completed (placeholder)', { timeRange });

      return [];

    } catch (error) {
      logger.error('Failed to get error hotspots', {
        timeRange,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Clean up old metrics
   */
  static async cleanupOldMetrics(retentionDays: number = 90): Promise<number> {
    const logger = appLogger.withJob('cleanup-old-metrics');

    try {
      logger.info('Starting metrics cleanup', { retentionDays });

      const deletedCount = await MonitoringMetricsModel.deleteOldMetrics(retentionDays);

      logger.info('Metrics cleanup completed', {
        deletedCount,
        retentionDays
      });

      return deletedCount;

    } catch (error) {
      logger.error('Failed to cleanup old metrics', {
        retentionDays,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get performance alerts (conditions that require attention)
   */
  static async getPerformanceAlerts(): Promise<{
    level: 'warning' | 'critical';
    type: 'response_time' | 'error_rate' | 'memory' | 'disk' | 'availability';
    message: string;
    value: number;
    threshold: number;
  }[]> {
    const logger = appLogger.withJob('get-performance-alerts');

    try {
      const alerts: any[] = [];

      // Get recent metrics summary
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - 1); // Last hour

      const summary = await MonitoringMetricsModel.getMetricsSummary({ startDate });

      // Check response time alerts
      if (summary.avgResponseTime > 5000) {
        alerts.push({
          level: 'critical',
          type: 'response_time',
          message: 'Average response time is critically high',
          value: summary.avgResponseTime,
          threshold: 5000
        });
      } else if (summary.avgResponseTime > 2000) {
        alerts.push({
          level: 'warning',
          type: 'response_time',
          message: 'Average response time is elevated',
          value: summary.avgResponseTime,
          threshold: 2000
        });
      }

      // Check error rate alerts
      if (summary.errorRate > 15) {
        alerts.push({
          level: 'critical',
          type: 'error_rate',
          message: 'Error rate is critically high',
          value: summary.errorRate,
          threshold: 15
        });
      } else if (summary.errorRate > 5) {
        alerts.push({
          level: 'warning',
          type: 'error_rate',
          message: 'Error rate is elevated',
          value: summary.errorRate,
          threshold: 5
        });
      }

      // Check memory usage
      const systemMetrics = getCurrentSystemMetrics();
      if (systemMetrics.memoryUsageMb > 1000) {
        alerts.push({
          level: 'critical',
          type: 'memory',
          message: 'Memory usage is critically high',
          value: systemMetrics.memoryUsageMb,
          threshold: 1000
        });
      } else if (systemMetrics.memoryUsageMb > 500) {
        alerts.push({
          level: 'warning',
          type: 'memory',
          message: 'Memory usage is elevated',
          value: systemMetrics.memoryUsageMb,
          threshold: 500
        });
      }

      logger.info('Performance alerts generated', {
        alertCount: alerts.length,
        criticalAlerts: alerts.filter(a => a.level === 'critical').length
      });

      return alerts;

    } catch (error) {
      logger.error('Failed to generate performance alerts', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Helper to get start date for different time ranges
   */
  private static getStartDateForRange(timeRange: '1h' | '24h' | '7d'): Date {
    const date = new Date();

    switch (timeRange) {
      case '1h':
        date.setHours(date.getHours() - 1);
        break;
      case '24h':
        date.setHours(date.getHours() - 24);
        break;
      case '7d':
        date.setDate(date.getDate() - 7);
        break;
    }

    return date;
  }
}

export default MonitoringService;