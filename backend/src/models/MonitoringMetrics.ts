import { db } from '../config/database';
import { dbLogger } from '../utils/logger';

export interface MonitoringMetric {
  id?: string;
  correlationId: string;
  userId?: string;
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs: number;
  requestSizeBytes?: number;
  responseSizeBytes?: number;
  memoryUsageMb?: number;
  cpuUsagePercent?: number;
  isError: boolean;
  errorType?: string;
  errorMessage?: string;
  userAgent?: string;
  ipAddress?: string;
  requestTimestamp: Date;
  createdAt?: Date;
}

export interface MetricsSummary {
  avgResponseTime: number;
  errorRate: number;
  requestCount: number;
  avgMemoryUsage: number;
  avgCpuUsage: number;
  statusCodeDistribution: { [key: string]: number };
  topSlowEndpoints: { path: string; avgResponseTime: number; count: number }[];
}

export interface MetricsFilter {
  startDate?: Date;
  endDate?: Date;
  path?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  isError?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Model for handling monitoring metrics data
 */
export class MonitoringMetricsModel {

  /**
   * Create a new monitoring metric entry
   */
  static async create(metric: Omit<MonitoringMetric, 'id' | 'createdAt'>): Promise<MonitoringMetric> {
    const logger = dbLogger.withJob('create-metric');

    try {
      const query = `
        INSERT INTO monitoring_metrics (
          correlation_id, user_id, method, path, status_code,
          response_time_ms, request_size_bytes, response_size_bytes,
          memory_usage_mb, cpu_usage_percent, is_error,
          error_type, error_message, user_agent, ip_address, request_timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `;

      const values = [
        metric.correlationId,
        metric.userId || null,
        metric.method,
        metric.path,
        metric.statusCode,
        metric.responseTimeMs,
        metric.requestSizeBytes || 0,
        metric.responseSizeBytes || 0,
        metric.memoryUsageMb || null,
        metric.cpuUsagePercent || null,
        metric.isError,
        metric.errorType || null,
        metric.errorMessage || null,
        metric.userAgent || null,
        metric.ipAddress || null,
        metric.requestTimestamp
      ];

      logger.debug('Creating monitoring metric', {
        correlationId: metric.correlationId,
        path: metric.path,
        method: metric.method,
        responseTime: metric.responseTimeMs
      });

      const result = await db.query(query, values);

      logger.info('Monitoring metric created successfully', {
        id: result.rows[0].id,
        correlationId: metric.correlationId
      });

      return this.mapDbRowToMetric(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create monitoring metric', {
        correlationId: metric.correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get metrics with filtering and pagination
   */
  static async getMetrics(filter: MetricsFilter = {}): Promise<MonitoringMetric[]> {
    const logger = dbLogger.withJob('get-metrics');

    try {
      let whereClause = 'WHERE 1=1';
      const values: any[] = [];
      let valueIndex = 1;

      // Build WHERE clause based on filters
      if (filter.startDate) {
        whereClause += ` AND request_timestamp >= $${valueIndex}`;
        values.push(filter.startDate);
        valueIndex++;
      }

      if (filter.endDate) {
        whereClause += ` AND request_timestamp <= $${valueIndex}`;
        values.push(filter.endDate);
        valueIndex++;
      }

      if (filter.path) {
        whereClause += ` AND path = $${valueIndex}`;
        values.push(filter.path);
        valueIndex++;
      }

      if (filter.method) {
        whereClause += ` AND method = $${valueIndex}`;
        values.push(filter.method);
        valueIndex++;
      }

      if (filter.statusCode) {
        whereClause += ` AND status_code = $${valueIndex}`;
        values.push(filter.statusCode);
        valueIndex++;
      }

      if (filter.userId) {
        whereClause += ` AND user_id = $${valueIndex}`;
        values.push(filter.userId);
        valueIndex++;
      }

      if (filter.isError !== undefined) {
        whereClause += ` AND is_error = $${valueIndex}`;
        values.push(filter.isError);
        valueIndex++;
      }

      const query = `
        SELECT * FROM monitoring_metrics
        ${whereClause}
        ORDER BY request_timestamp DESC
        LIMIT $${valueIndex} OFFSET $${valueIndex + 1}
      `;

      values.push(filter.limit || 100);
      values.push(filter.offset || 0);

      logger.debug('Fetching metrics with filter', { filter });

      const result = await db.query(query, values);

      logger.info('Metrics fetched successfully', {
        count: result.rows.length,
        hasFilter: Object.keys(filter).length > 0
      });

      return result.rows.map(this.mapDbRowToMetric);
    } catch (error) {
      logger.error('Failed to fetch metrics', {
        filter,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get metrics summary and analytics
   */
  static async getMetricsSummary(filter: MetricsFilter = {}): Promise<MetricsSummary> {
    const logger = dbLogger.withJob('get-metrics-summary');

    try {
      let whereClause = 'WHERE 1=1';
      const values: any[] = [];
      let valueIndex = 1;

      // Apply same filters as getMetrics
      if (filter.startDate) {
        whereClause += ` AND request_timestamp >= $${valueIndex}`;
        values.push(filter.startDate);
        valueIndex++;
      }

      if (filter.endDate) {
        whereClause += ` AND request_timestamp <= $${valueIndex}`;
        values.push(filter.endDate);
        valueIndex++;
      }

      // Main summary query
      const summaryQuery = `
        SELECT
          AVG(response_time_ms) as avg_response_time,
          AVG(CASE WHEN memory_usage_mb IS NOT NULL THEN memory_usage_mb ELSE 0 END) as avg_memory_usage,
          AVG(CASE WHEN cpu_usage_percent IS NOT NULL THEN cpu_usage_percent ELSE 0 END) as avg_cpu_usage,
          COUNT(*) as total_requests,
          COUNT(CASE WHEN is_error = true THEN 1 END) as error_count
        FROM monitoring_metrics
        ${whereClause}
      `;

      // Status code distribution query
      const statusQuery = `
        SELECT status_code, COUNT(*) as count
        FROM monitoring_metrics
        ${whereClause}
        GROUP BY status_code
        ORDER BY status_code
      `;

      // Top slow endpoints query
      const slowEndpointsQuery = `
        SELECT
          path,
          AVG(response_time_ms) as avg_response_time,
          COUNT(*) as count
        FROM monitoring_metrics
        ${whereClause}
        GROUP BY path
        ORDER BY avg_response_time DESC
        LIMIT 10
      `;

      logger.debug('Generating metrics summary', { filter });

      // Execute all queries
      const [summaryResult, statusResult, slowEndpointsResult] = await Promise.all([
        db.query(summaryQuery, values),
        db.query(statusQuery, values),
        db.query(slowEndpointsQuery, values)
      ]);

      const summary = summaryResult.rows[0];
      const totalRequests = parseInt(summary.total_requests) || 0;
      const errorCount = parseInt(summary.error_count) || 0;

      const statusCodeDistribution: { [key: string]: number } = {};
      statusResult.rows.forEach(row => {
        statusCodeDistribution[row.status_code] = parseInt(row.count);
      });

      const topSlowEndpoints = slowEndpointsResult.rows.map(row => ({
        path: row.path,
        avgResponseTime: parseFloat(row.avg_response_time),
        count: parseInt(row.count)
      }));

      const result: MetricsSummary = {
        avgResponseTime: parseFloat(summary.avg_response_time) || 0,
        errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0,
        requestCount: totalRequests,
        avgMemoryUsage: parseFloat(summary.avg_memory_usage) || 0,
        avgCpuUsage: parseFloat(summary.avg_cpu_usage) || 0,
        statusCodeDistribution,
        topSlowEndpoints
      };

      logger.info('Metrics summary generated successfully', {
        totalRequests,
        errorRate: result.errorRate,
        avgResponseTime: result.avgResponseTime
      });

      return result;
    } catch (error) {
      logger.error('Failed to generate metrics summary', {
        filter,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Delete old metrics (for cleanup)
   */
  static async deleteOldMetrics(olderThanDays: number = 90): Promise<number> {
    const logger = dbLogger.withJob('cleanup-metrics');

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const query = `
        DELETE FROM monitoring_metrics
        WHERE request_timestamp < $1
      `;

      logger.debug('Cleaning up old metrics', { cutoffDate, olderThanDays });

      const result = await db.query(query, [cutoffDate]);
      const deletedCount = result.rowCount || 0;

      logger.info('Old metrics cleaned up', {
        deletedCount,
        cutoffDate
      });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old metrics', {
        olderThanDays,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Map database row to MonitoringMetric object
   */
  private static mapDbRowToMetric(row: any): MonitoringMetric {
    return {
      id: row.id,
      correlationId: row.correlation_id,
      userId: row.user_id,
      method: row.method,
      path: row.path,
      statusCode: row.status_code,
      responseTimeMs: row.response_time_ms,
      requestSizeBytes: row.request_size_bytes,
      responseSizeBytes: row.response_size_bytes,
      memoryUsageMb: row.memory_usage_mb ? parseFloat(row.memory_usage_mb) : undefined,
      cpuUsagePercent: row.cpu_usage_percent ? parseFloat(row.cpu_usage_percent) : undefined,
      isError: row.is_error,
      errorType: row.error_type,
      errorMessage: row.error_message,
      userAgent: row.user_agent,
      ipAddress: row.ip_address,
      requestTimestamp: row.request_timestamp,
      createdAt: row.created_at
    };
  }
}

export default MonitoringMetricsModel;