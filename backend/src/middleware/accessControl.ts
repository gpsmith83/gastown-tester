import { Request, Response, NextFunction } from 'express';
import { WorkspaceModel } from '../models/Workspace';
import { ProjectModel } from '../models/Project';
import { RequirementModel } from '../models/Requirement';
import { User } from '../models/types';

/**
 * Centralized access control middleware for workspace isolation and permission checks.
 * These middlewares ensure proper tenant boundaries and prevent cross-workspace access.
 */

/**
 * Middleware to check if user has access to a workspace.
 * Expects workspace ID in req.params.workspaceId or req.body.workspace_id
 */
export async function requireWorkspaceAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as User;
    const workspaceId = req.params.workspaceId || req.body.workspace_id;

    if (!workspaceId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Workspace ID is required'
      });
    }

    const membership = await WorkspaceModel.isUserMember(workspaceId, user.id);
    if (!membership) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this workspace'
      });
    }

    // Store membership info for use in subsequent middleware/handlers
    (req as any).workspaceMembership = membership;
    (req as any).workspaceId = workspaceId;

    next();
  } catch (error) {
    console.error('Workspace access check error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify workspace access'
    });
  }
}

/**
 * Middleware to check if user has access to a project.
 * Expects project ID in req.params.projectId or req.params.id
 */
export async function requireProjectAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as User;
    const projectId = req.params.projectId || req.params.id;

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Project ID is required'
      });
    }

    const hasAccess = await ProjectModel.canUserAccess(projectId, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    // Store project info for use in subsequent middleware/handlers
    (req as any).projectId = projectId;

    next();
  } catch (error) {
    console.error('Project access check error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify project access'
    });
  }
}

/**
 * Middleware to check if user has access to a requirement.
 * Expects requirement ID in req.params.requirementId or req.params.id
 */
export async function requireRequirementAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as User;
    const requirementId = req.params.requirementId || req.params.id;

    if (!requirementId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Requirement ID is required'
      });
    }

    const hasAccess = await RequirementModel.canUserAccess(requirementId, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    // Store requirement info for use in subsequent middleware/handlers
    (req as any).requirementId = requirementId;

    next();
  } catch (error) {
    console.error('Requirement access check error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify requirement access'
    });
  }
}

/**
 * Middleware to check if user owns a workspace.
 * Requires workspace access check to run first.
 */
export function requireWorkspaceOwnership(req: Request, res: Response, next: NextFunction) {
  const membership = (req as any).workspaceMembership;

  if (!membership || membership.role !== 'owner') {
    return res.status(403).json({
      error: 'Access Denied',
      message: 'Only workspace owners can perform this action'
    });
  }

  next();
}

/**
 * Middleware to check if user is workspace owner or admin.
 * Requires workspace access check to run first.
 */
export function requireWorkspaceAdmin(req: Request, res: Response, next: NextFunction) {
  const membership = (req as any).workspaceMembership;

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return res.status(403).json({
      error: 'Access Denied',
      message: 'Only workspace owners and administrators can perform this action'
    });
  }

  next();
}

/**
 * Middleware to check if user owns a project.
 * Expects project ID in req.params.projectId or req.params.id
 */
export async function requireProjectOwnership(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as User;
    const projectId = req.params.projectId || req.params.id;

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Project ID is required'
      });
    }

    const isOwner = await ProjectModel.isUserOwner(projectId, user.id);
    if (!isOwner) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'Only project owners can perform this action'
      });
    }

    next();
  } catch (error) {
    console.error('Project ownership check error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify project ownership'
    });
  }
}

/**
 * Middleware to check if user is the author of a requirement.
 * Expects requirement ID in req.params.requirementId or req.params.id
 */
export async function requireRequirementAuthorship(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as User;
    const requirementId = req.params.requirementId || req.params.id;

    if (!requirementId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Requirement ID is required'
      });
    }

    const isAuthor = await RequirementModel.isUserAuthor(requirementId, user.id);
    if (!isAuthor) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'Only requirement authors can perform this action'
      });
    }

    next();
  } catch (error) {
    console.error('Requirement authorship check error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify requirement authorship'
    });
  }
}

/**
 * Enhanced cross-workspace access prevention middleware.
 * Validates that project belongs to the workspace when both are provided.
 */
export async function preventCrossWorkspaceAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId || req.body.workspace_id || (req as any).workspaceId;
    const projectId = req.params.projectId || req.body.project_id || (req as any).projectId;

    // If both workspace and project are specified, verify they match
    if (workspaceId && projectId) {
      const project = await ProjectModel.findById(projectId);

      if (!project) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found'
        });
      }

      if (project.workspace_id !== workspaceId) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'Project does not belong to the specified workspace'
        });
      }
    }

    // Similar check for requirements
    const requirementId = req.params.requirementId || req.body.requirement_id || (req as any).requirementId;
    if (projectId && requirementId) {
      const requirement = await RequirementModel.findById(requirementId);

      if (!requirement) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Requirement not found'
        });
      }

      if (requirement.project_id !== projectId) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'Requirement does not belong to the specified project'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Cross-workspace access prevention error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify resource relationships'
    });
  }
}