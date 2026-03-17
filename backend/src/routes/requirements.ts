import { Router, Request, Response } from 'express';
import { requireAuth } from '../config/auth';
import { RequirementModel } from '../models/Requirement';
import { ProjectModel } from '../models/Project';
import { SecretManager } from '../services/SecretManager';
import { CreateRequirementRequest } from '../models/types';
import { User } from '../models/types';

const router = Router();

// All requirement routes require authentication
router.use(requireAuth);

// Get user's requirements (across all projects they have access to)
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const requirements = await RequirementModel.findByUserId(user.id);

    res.json({
      requirements,
      total: requirements.length
    });
  } catch (error) {
    console.error('[REQUIREMENT_ROUTES] Error fetching requirements:', SecretManager.redactSensitiveData(error));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch requirements'
    });
  }
});

// Get requirements in a specific project
router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { projectId } = req.params;

    // Check if user has access to this project
    const hasAccess = await ProjectModel.canUserAccess(projectId, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    const requirements = await RequirementModel.findByProjectId(projectId);

    res.json({
      requirements,
      project_id: projectId,
      total: requirements.length
    });
  } catch (error) {
    console.error('[REQUIREMENT_ROUTES] Error fetching project requirements:', SecretManager.redactSensitiveData(error));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch project requirements'
    });
  }
});

// Create new requirement
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const data: CreateRequirementRequest = req.body;

    // Basic validation
    if (!data.title || data.title.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Requirement title is required'
      });
    }

    if (!data.project_id) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Project ID is required'
      });
    }

    if (data.title.length > 500) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Requirement title must be 500 characters or less'
      });
    }

    // Validate priority
    if (data.priority !== undefined && (data.priority < 1 || data.priority > 5)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Priority must be between 1 (highest) and 5 (lowest)'
      });
    }

    // Validate type
    if (data.type && !['feature', 'bug', 'enhancement', 'epic'].includes(data.type)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Type must be one of: feature, bug, enhancement, epic'
      });
    }

    // Check if user has access to the project
    const hasAccess = await ProjectModel.canUserAccess(data.project_id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    // Clean up data
    const cleanData: CreateRequirementRequest = {
      title: data.title.trim(),
      description: data.description?.trim(),
      project_id: data.project_id,
      priority: data.priority || 3,
      type: data.type || 'feature',
      github_issue_number: data.github_issue_number,
      github_issue_url: data.github_issue_url?.trim()
    };

    const requirement = await RequirementModel.create(cleanData, user.id);

    // Return requirement with full details
    const requirementWithDetails = await RequirementModel.findByIdWithDetails(requirement.id);

    res.status(201).json({
      requirement: requirementWithDetails,
      message: 'Requirement created successfully'
    });
  } catch (error) {
    console.error('[REQUIREMENT_ROUTES] Error creating requirement:', SecretManager.redactSensitiveData({
      error,
      requestData: SecretManager.redactSensitiveData(req.body)
    }));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create requirement'
    });
  }
});

// Get specific requirement
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user has access to this requirement
    const hasAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const requirement = await RequirementModel.findByIdWithDetails(id);
    if (!requirement) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Requirement not found'
      });
    }

    res.json({
      requirement
    });
  } catch (error) {
    console.error('[REQUIREMENT_ROUTES] Error fetching requirement:', SecretManager.redactSensitiveData({
      error,
      requirementId: req.params.id
    }));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch requirement'
    });
  }
});

// Update requirement
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const data: Partial<CreateRequirementRequest> = req.body;

    // Check if user has access to this requirement
    const hasAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    // For now, allow all project members to edit requirements
    // In the future, you might want to restrict to authors/admins

    // Basic validation
    if (data.title !== undefined) {
      if (!data.title || data.title.trim().length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Requirement title is required'
        });
      }

      if (data.title.length > 500) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Requirement title must be 500 characters or less'
        });
      }

      data.title = data.title.trim();
    }

    // Validate priority
    if (data.priority !== undefined && (data.priority < 1 || data.priority > 5)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Priority must be between 1 (highest) and 5 (lowest)'
      });
    }

    // Validate type
    if (data.type && !['feature', 'bug', 'enhancement', 'epic'].includes(data.type)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Type must be one of: feature, bug, enhancement, epic'
      });
    }

    // Clean up other fields
    if (data.description !== undefined) {
      data.description = data.description?.trim();
    }

    if (data.github_issue_url !== undefined) {
      data.github_issue_url = data.github_issue_url?.trim();
    }

    const requirement = await RequirementModel.update(id, data);
    if (!requirement) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Requirement not found'
      });
    }

    // Return updated requirement with full details
    const requirementWithDetails = await RequirementModel.findByIdWithDetails(requirement.id);

    res.json({
      requirement: requirementWithDetails,
      message: 'Requirement updated successfully'
    });
  } catch (error) {
    console.error('[REQUIREMENT_ROUTES] Error updating requirement:', SecretManager.redactSensitiveData({
      error,
      requirementId: req.params.id,
      updateData: SecretManager.redactSensitiveData(req.body)
    }));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update requirement'
    });
  }
});

// Update requirement status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { status } = req.body;

    if (!['draft', 'active', 'completed', 'archived'].includes(status)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid status. Must be draft, active, completed, or archived'
      });
    }

    // Check if user has access to this requirement
    const hasAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    // For now, allow all project members to change status
    // In the future, you might want to restrict to authors/admins

    const requirement = await RequirementModel.updateStatus(id, status);
    if (!requirement) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Requirement not found'
      });
    }

    res.json({
      requirement,
      message: `Requirement status updated to ${status} successfully`
    });
  } catch (error) {
    console.error('Error updating requirement status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update requirement status'
    });
  }
});

// Delete requirement (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user is the author of this requirement
    const isAuthor = await RequirementModel.isUserAuthor(id, user.id);
    if (!isAuthor) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'Only requirement authors can delete requirements'
      });
    }

    const deleted = await RequirementModel.delete(id);
    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Requirement not found'
      });
    }

    res.json({
      message: 'Requirement deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting requirement:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete requirement'
    });
  }
});

export default router;