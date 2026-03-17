import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Extend Express Request type to include correlation ID
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Middleware to add correlation IDs to incoming requests.
 * Generates a unique UUID for each request to enable request tracing.
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check for existing correlation ID in headers (for distributed tracing)
  const existingCorrelationId = req.headers['x-correlation-id'] as string;

  // Use existing ID or generate new one
  const correlationId = existingCorrelationId || randomUUID();

  // Attach to request object
  req.correlationId = correlationId;

  // Add to response headers for client visibility
  res.setHeader('x-correlation-id', correlationId);

  next();
}

/**
 * Extract correlation ID from request object
 */
export function getRequestCorrelationId(req: Request): string | undefined {
  return req.correlationId;
}