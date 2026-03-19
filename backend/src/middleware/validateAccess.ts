import { Request, Response, NextFunction } from 'express';
import { RequirementModel } from '../models/Requirement';
import { RefinementSessionModel } from '../models/RefinementSession';
import { User } from '../models/types';

// Extend Request interface to include validated entities
declare global {
  namespace Express {
    interface Request {
      validatedRequirement?: any;
      validatedSession?: any;
    }
  }
}

/**
 * Middleware to validate user access to various resources
 * @param resourceType - Type of resource to validate ('requirement', 'session')
 */
export function validateAccess(resourceType: 'requirement' | 'session') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      switch (resourceType) {
        case 'requirement': {
          const { requirement_id } = req.params;
          if (!requirement_id) {
            return res.status(400).json({ error: 'Requirement ID is required' });
          }

          // Check if user can access this requirement
          const canAccess = await RequirementModel.canUserAccess(requirement_id, user.id);
          if (!canAccess) {
            return res.status(403).json({
              error: 'Access denied to this requirement'
            });
          }

          // Optionally load the requirement for use in the route handler
          const requirement = await RequirementModel.findById(requirement_id);
          if (!requirement) {
            return res.status(404).json({ error: 'Requirement not found' });
          }

          req.validatedRequirement = requirement;
          break;
        }

        case 'session': {
          const { session_id } = req.params;
          if (!session_id) {
            return res.status(400).json({ error: 'Session ID is required' });
          }

          // Check if user can access this session
          const canAccess = await RefinementSessionModel.canUserAccess(session_id, user.id);
          if (!canAccess) {
            return res.status(403).json({
              error: 'Access denied to this refinement session'
            });
          }

          // Optionally load the session for use in the route handler
          const session = await RefinementSessionModel.findById(session_id);
          if (!session) {
            return res.status(404).json({ error: 'Refinement session not found' });
          }

          req.validatedSession = session;
          break;
        }

        default:
          return res.status(400).json({ error: `Unknown resource type: ${resourceType}` });
      }

      next();
    } catch (error) {
      console.error(`[VALIDATE_ACCESS] Error validating ${resourceType} access:`, error);
      res.status(500).json({ error: 'Failed to validate access' });
    }
  };
}