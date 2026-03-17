import { Request, Response, NextFunction } from 'express';
import { createErrorResponse } from '@gastown-tester/shared';

/**
 * Middleware to ensure user is authenticated
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }

  res.status(401).json(createErrorResponse('Authentication required'));
};

/**
 * Middleware to optionally authenticate user (doesn't fail if not authenticated)
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  // This middleware just passes through - the authentication status
  // is available via req.isAuthenticated() and req.user
  next();
};