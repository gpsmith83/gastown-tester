import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

/**
 * Security middleware for hardening workspace isolation and API protection.
 * Implements security headers, rate limiting, and additional protections.
 */

/**
 * Security headers middleware
 * Adds comprehensive security headers to prevent common attacks
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Prevent referrer information leakage
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // Note: 'unsafe-inline' should be removed in production
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);

  // Strict Transport Security (HTTPS only)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}

/**
 * Rate limiting for API endpoints
 * Different limits for different types of operations
 */

// General API rate limiting
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Rate Limit Exceeded',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication endpoint rate limiting (more restrictive)
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 auth requests per windowMs
  message: {
    error: 'Rate Limit Exceeded',
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Create operations rate limiting
export const createRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit each IP to 50 create operations per 5 minutes
  message: {
    error: 'Rate Limit Exceeded',
    message: 'Too many create operations, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Update operations rate limiting
export const updateRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // Limit each IP to 100 update operations per 5 minutes
  message: {
    error: 'Rate Limit Exceeded',
    message: 'Too many update operations, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Input sanitization middleware
 * Prevents injection attacks by sanitizing input data
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // Recursive function to sanitize strings in objects
  function sanitizeValue(value: any): any {
    if (typeof value === 'string') {
      // Remove potentially dangerous characters and normalize whitespace
      return value
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .trim();
    } else if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    } else if (value && typeof value === 'object') {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        // Sanitize both key and value
        const cleanKey = typeof key === 'string' ? key.replace(/[^\w\-_.]/g, '') : key;
        sanitized[cleanKey] = sanitizeValue(val);
      }
      return sanitized;
    }
    return value;
  }

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }

  next();
}

/**
 * Request size limiting middleware
 * Prevents DoS attacks via large payloads
 */
export function requestSizeLimit(maxSizeBytes: number = 1024 * 1024) { // Default 1MB
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers['content-length'];

    if (contentLength && parseInt(contentLength) > maxSizeBytes) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: 'Request payload exceeds size limit'
      });
    }

    next();
  };
}

/**
 * IP-based access logging for security monitoring
 */
export function securityLogging(req: Request, res: Response, next: NextFunction) {
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];
  const method = req.method;
  const url = req.url;
  const timestamp = new Date().toISOString();

  // Log security-relevant requests
  if (req.url.includes('/auth') || req.method !== 'GET') {
    console.log(`[SECURITY] ${timestamp} ${clientIP} ${method} ${url} UserAgent: ${userAgent}`);
  }

  next();
}

/**
 * Tenant isolation validation middleware
 * Additional checks to ensure proper tenant boundaries
 */
export function validateTenantIsolation(req: Request, res: Response, next: NextFunction) {
  // Check for suspicious patterns that might indicate cross-tenant access attempts
  const suspiciousPatterns = [
    /\.\./,  // Path traversal
    /[<>]/,  // Potential XSS
    /union\s+select/i,  // SQL injection
    /script:/i,  // Script injection
  ];

  const checkSuspiciousValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    } else if (Array.isArray(value)) {
      return value.some(checkSuspiciousValue);
    } else if (value && typeof value === 'object') {
      return Object.values(value).some(checkSuspiciousValue);
    }
    return false;
  };

  // Check all input sources
  const inputSources = [req.params, req.query, req.body].filter(Boolean);

  for (const source of inputSources) {
    if (checkSuspiciousValue(source)) {
      console.warn(`[SECURITY] Suspicious input detected from ${req.ip}: ${JSON.stringify(source)}`);
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid input detected'
      });
    }
  }

  next();
}