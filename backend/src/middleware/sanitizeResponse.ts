import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to sanitize API responses and prevent exposure of sensitive data
 */

// Fields that should never be exposed in API responses
const SENSITIVE_FIELDS = [
  'password',
  'api_token_hash',
  'encrypted_token',
  'secret',
  'token_hash',
  'refresh_token',
  'access_token',
  'private_key',
  'api_key',
  'client_secret'
];

// Helper function to deep clone and sanitize objects
function sanitizeObject(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive fields completely
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
      continue;
    }

    // Recursively sanitize nested objects
    sanitized[key] = sanitizeObject(value);
  }

  return sanitized;
}

/**
 * Express middleware that sanitizes JSON responses before sending
 */
export function sanitizeResponse(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json;

  res.json = function(data: any) {
    // Only sanitize if we have data to sanitize
    if (data && typeof data === 'object') {
      try {
        const sanitizedData = sanitizeObject(data);
        return originalJson.call(this, sanitizedData);
      } catch (error) {
        console.error('[SANITIZE_RESPONSE] Error sanitizing response:', error);
        // If sanitization fails, fall back to original data
        return originalJson.call(this, data);
      }
    }

    return originalJson.call(this, data);
  };

  next();
}

/**
 * Function to explicitly sanitize data in route handlers
 * Use this when you need to sanitize specific fields beyond the automatic middleware
 */
export function sanitizeData<T>(data: T): T {
  return sanitizeObject(data) as T;
}