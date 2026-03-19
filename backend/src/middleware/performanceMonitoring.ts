import { Request, Response, NextFunction } from 'express';
import { MonitoringMetricsModel } from '../models/MonitoringMetrics';
import { apiLogger } from '../utils/logger';
import { performance } from 'perf_hooks';

// Extend Express Request type to include performance data
declare global {
  namespace Express {
    interface Request {
      startTime?: number;
      responseSize?: number;
    }
  }
}

/**
 * Get system resource usage (CPU and Memory)
 */
function getResourceUsage(): { memoryUsageMb: number; cpuUsagePercent?: number } {
  const memoryUsage = process.memoryUsage();
  const memoryUsageMb = memoryUsage.heapUsed / (1024 * 1024);

  // CPU usage calculation is approximate since we can't easily get instant CPU usage in Node.js
  // For now, we'll use undefined and can enhance this with external libraries if needed
  const cpuUsagePercent = undefined;

  return {
    memoryUsageMb: Math.round(memoryUsageMb * 100) / 100, // Round to 2 decimal places
    cpuUsagePercent
  };
}

/**
 * Extract error information from response
 */
function extractErrorInfo(statusCode: number, responseData?: any): {
  isError: boolean;
  errorType?: string;
  errorMessage?: string;
} {
  const isError = statusCode >= 400;

  if (!isError) {
    return { isError: false };
  }

  let errorType = 'unknown';
  let errorMessage = 'Unknown error';

  if (statusCode >= 400 && statusCode < 500) {
    errorType = 'client_error';
  } else if (statusCode >= 500) {
    errorType = 'server_error';
  }

  // Try to extract error message from response data
  if (responseData && typeof responseData === 'object') {
    try {
      const parsed = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      if (parsed.error) {
        errorMessage = parsed.error;
      } else if (parsed.message) {
        errorMessage = parsed.message;
      }
    } catch (e) {
      // If parsing fails, use default message
      errorMessage = `HTTP ${statusCode}`;
    }
  } else {
    errorMessage = `HTTP ${statusCode}`;
  }

  return {
    isError,
    errorType,
    errorMessage: errorMessage.substring(0, 1000) // Truncate to prevent extremely long messages
  };
}

/**
 * Middleware to monitor API performance and collect metrics
 */
export function performanceMonitoringMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip monitoring for health checks and monitoring endpoints to avoid noise
  if (req.path === '/health' || req.path.startsWith('/api/monitoring')) {
    return next();
  }

  const logger = apiLogger.withRequest(req);

  // Record start time
  req.startTime = performance.now();

  // Get initial resource usage
  const initialResources = getResourceUsage();

  // Capture request size
  const requestSize = req.headers['content-length'] ? parseInt(req.headers['content-length']) : 0;

  // Store original send method to capture response
  const originalSend = res.send;
  let responseData: any;

  // Override send method to capture response data and size
  res.send = function(this: Response, data?: any): Response {
    // Store response data for error analysis
    responseData = data;

    // Calculate response size
    if (data) {
      req.responseSize = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data.toString());
    }

    // Call original send method
    return originalSend.call(this, data);
  };

  // Listen for response finish event to capture metrics
  res.on('finish', async () => {
    try {
      // Calculate response time
      const endTime = performance.now();
      const responseTimeMs = Math.round(endTime - (req.startTime || endTime));

      // Get final resource usage (could be different from initial, especially memory)
      const finalResources = getResourceUsage();

      // Extract error information
      const { isError, errorType, errorMessage } = extractErrorInfo(res.statusCode, responseData);

      // Get user ID if available
      const userId = (req as any).user?.id;

      // Create metric entry
      const metric = {
        correlationId: req.correlationId || 'unknown',
        userId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTimeMs,
        requestSizeBytes: requestSize,
        responseSizeBytes: req.responseSize || 0,
        memoryUsageMb: finalResources.memoryUsageMb,
        cpuUsagePercent: finalResources.cpuUsagePercent,
        isError,
        errorType,
        errorMessage,
        userAgent: req.headers['user-agent']?.substring(0, 1000), // Truncate long user agents
        ipAddress: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
        requestTimestamp: new Date()
      };

      // Store metrics asynchronously (don't block response)
      setImmediate(async () => {
        try {
          await MonitoringMetricsModel.create(metric);

          // Log slow requests
          if (responseTimeMs > 1000) {
            logger.warn(`Slow request detected: ${responseTimeMs}ms`, {
              operation: 'slow_request',
              path: req.path,
              method: req.method,
              responseTime: responseTimeMs,
              statusCode: res.statusCode
            });
          }

          // Log errors
          if (isError) {
            logger.warn(`Error response: ${res.statusCode}`, {
              operation: 'error_response',
              path: req.path,
              method: req.method,
              statusCode: res.statusCode,
              errorType,
              errorMessage: errorMessage?.substring(0, 200)
            });
          }

        } catch (error) {
          logger.error('Failed to store performance metric', {
            operation: 'metric_storage_failed',
            path: req.path,
            method: req.method,
            correlationId: req.correlationId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

    } catch (error) {
      logger.error('Performance monitoring failed', {
        operation: 'performance_monitoring_failed',
        path: req.path,
        method: req.method,
        correlationId: req.correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  next();
}

/**
 * Get current system metrics snapshot
 */
export function getCurrentSystemMetrics(): {
  memoryUsageMb: number;
  cpuUsagePercent?: number;
  uptime: number;
  processId: number;
} {
  const { memoryUsageMb, cpuUsagePercent } = getResourceUsage();

  return {
    memoryUsageMb,
    cpuUsagePercent,
    uptime: process.uptime(),
    processId: process.pid
  };
}