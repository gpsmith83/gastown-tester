import { Request } from 'express';
import { randomUUID } from 'crypto';

export interface LogContext {
  correlationId?: string;
  jobId?: string;
  userId?: string;
  component?: string;
  operation?: string;
  [key: string]: any;
}

export interface StructuredLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context: LogContext;
}

/**
 * Structured logger for correlation tracking
 */
export class Logger {
  private component: string;

  constructor(component: string = 'app') {
    this.component = component;
  }

  /**
   * Create log entry with correlation context
   */
  private createLogEntry(
    level: StructuredLog['level'],
    message: string,
    context: Partial<LogContext> = {}
  ): StructuredLog {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        component: this.component,
        ...context
      }
    };
  }

  /**
   * Format log for output
   */
  private formatLog(log: StructuredLog): string {
    const contextParts: string[] = [];

    if (log.context.correlationId) {
      contextParts.push(`req=${log.context.correlationId.slice(0, 8)}`);
    }

    if (log.context.jobId) {
      contextParts.push(`job=${log.context.jobId.slice(0, 8)}`);
    }

    if (log.context.userId) {
      contextParts.push(`user=${log.context.userId}`);
    }

    if (log.context.component) {
      contextParts.push(`component=${log.context.component}`);
    }

    if (log.context.operation) {
      contextParts.push(`op=${log.context.operation}`);
    }

    const contextStr = contextParts.length > 0 ? ` [${contextParts.join(', ')}]` : '';

    return `[${log.timestamp}] ${log.level.toUpperCase()}${contextStr}: ${log.message}`;
  }

  /**
   * Log info message
   */
  info(message: string, context: Partial<LogContext> = {}): void {
    const log = this.createLogEntry('info', message, context);
    console.log(this.formatLog(log));
  }

  /**
   * Log warning message
   */
  warn(message: string, context: Partial<LogContext> = {}): void {
    const log = this.createLogEntry('warn', message, context);
    console.warn(this.formatLog(log));
  }

  /**
   * Log error message
   */
  error(message: string, context: Partial<LogContext> = {}): void {
    const log = this.createLogEntry('error', message, context);
    console.error(this.formatLog(log));
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, context: Partial<LogContext> = {}): void {
    if (process.env.NODE_ENV === 'development') {
      const log = this.createLogEntry('debug', message, context);
      console.debug(this.formatLog(log));
    }
  }

  /**
   * Create logger with request context
   */
  withRequest(req: Request): RequestLogger {
    return new RequestLogger(this.component, req);
  }

  /**
   * Create logger with job context
   */
  withJob(jobId: string): JobLogger {
    return new JobLogger(this.component, jobId);
  }
}

/**
 * Request-aware logger that includes correlation ID
 */
export class RequestLogger extends Logger {
  private req: Request;

  constructor(component: string, req: Request) {
    super(component);
    this.req = req;
  }

  private getRequestContext(): Partial<LogContext> {
    return {
      correlationId: this.req.correlationId,
      userId: (this.req as any).user?.id?.toString(),
    };
  }

  info(message: string, context: Partial<LogContext> = {}): void {
    super.info(message, { ...this.getRequestContext(), ...context });
  }

  warn(message: string, context: Partial<LogContext> = {}): void {
    super.warn(message, { ...this.getRequestContext(), ...context });
  }

  error(message: string, context: Partial<LogContext> = {}): void {
    super.error(message, { ...this.getRequestContext(), ...context });
  }

  debug(message: string, context: Partial<LogContext> = {}): void {
    super.debug(message, { ...this.getRequestContext(), ...context });
  }
}

/**
 * Job-aware logger for background processing
 */
export class JobLogger extends Logger {
  private jobId: string;

  constructor(component: string, jobId: string) {
    super(component);
    this.jobId = jobId;
  }

  private getJobContext(): Partial<LogContext> {
    return {
      jobId: this.jobId,
    };
  }

  info(message: string, context: Partial<LogContext> = {}): void {
    super.info(message, { ...this.getJobContext(), ...context });
  }

  warn(message: string, context: Partial<LogContext> = {}): void {
    super.warn(message, { ...this.getJobContext(), ...context });
  }

  error(message: string, context: Partial<LogContext> = {}): void {
    super.error(message, { ...this.getJobContext(), ...context });
  }

  debug(message: string, context: Partial<LogContext> = {}): void {
    super.debug(message, { ...this.getJobContext(), ...context });
  }
}

/**
 * Utility functions for correlation tracking
 */
export function generateJobId(): string {
  return randomUUID();
}

export function extractCorrelationId(req: Request): string | undefined {
  return req.correlationId;
}

// Export singleton instances for common use
export const appLogger = new Logger('app');
export const apiLogger = new Logger('api');
export const dbLogger = new Logger('database');
export const aiLogger = new Logger('ai-provider');