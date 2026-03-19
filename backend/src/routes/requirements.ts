import { Router, Request, Response } from 'express';
import { requireAuth } from '../config/auth';
import { RequirementModel } from '../models/Requirement';
import { RequirementCommentModel } from '../models/RequirementComment';
import { RequirementHistoryModel } from '../models/RequirementHistory';
import { RequirementWatcherModel } from '../models/RequirementWatcher';
import { RequirementDependencyModel } from '../models/RequirementDependency';
import { ProjectModel } from '../models/Project';
import {
  CreateRequirementRequest,
  CreateRequirementAdvancedRequest,
  CreateRequirementCommentRequest,
  UpdateRequirementAssignmentRequest,
  UpdateRequirementStatusRequest,
  UpdateRequirementPriorityRequest,
  UpdateRequirementLifecycleRequest,
  CreateRequirementDependencyRequest,
  AddRequirementWatcherRequest,
  User
} from '../models/types';

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
    console.error('Error fetching requirements:', error);
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
    console.error('Error fetching project requirements:', error);
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
    console.error('Error creating requirement:', error);
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
    console.error('Error fetching requirement:', error);
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
    console.error('Error updating requirement:', error);
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

    const requirement = await RequirementModel.updateStatus(id, { status }, user.id);
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

// Advanced workflow endpoints for B-404, B-405, B-406, B-407

// Create requirement with advanced workflow features
router.post('/advanced', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const data: CreateRequirementAdvancedRequest = req.body;

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

    // Check if user has access to the project
    const hasAccess = await ProjectModel.canUserAccess(data.project_id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    const requirement = await RequirementModel.createAdvanced(data, user.id);
    const requirementWithDetails = await RequirementModel.findByIdWithWorkflowDetails(requirement.id);

    res.status(201).json({
      requirement: requirementWithDetails,
      message: 'Advanced requirement created successfully'
    });
  } catch (error) {
    console.error('Error creating advanced requirement:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create advanced requirement'
    });
  }
});

// Get requirement with full workflow details (B-404, B-405, B-406, B-407)
router.get('/:id/workflow', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user can access this requirement
    const canAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!canAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const requirement = await RequirementModel.findByIdWithWorkflowDetails(id);
    if (!requirement) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Requirement not found'
      });
    }

    res.json({ requirement });
  } catch (error) {
    console.error('Error fetching requirement workflow details:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch requirement workflow details'
    });
  }
});

// B-405: Update assignment
router.patch('/:id/assignment', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const data: UpdateRequirementAssignmentRequest = req.body;

    // Check if user can modify this requirement
    const canModify = await RequirementModel.canUserModify(id, user.id);
    if (!canModify) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to modify this requirement'
      });
    }

    const requirement = await RequirementModel.updateAssignment(id, data, user.id);
    if (!requirement) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Requirement not found'
      });
    }

    res.json({
      requirement,
      message: 'Assignment updated successfully'
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update assignment'
    });
  }
});

// B-404: Update status with advanced workflow
router.patch('/:id/status-advanced', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const data: UpdateRequirementStatusRequest = req.body;

    // Validate status
    const validStatuses = ['draft', 'open', 'in_progress', 'in_review', 'testing', 'blocked', 'completed', 'archived', 'cancelled'];
    if (!validStatuses.includes(data.status)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Check if user can modify this requirement
    const canModify = await RequirementModel.canUserModify(id, user.id);
    if (!canModify) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to modify this requirement'
      });
    }

    const requirement = await RequirementModel.updateStatus(id, data, user.id);
    if (!requirement) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Requirement not found'
      });
    }

    res.json({
      requirement,
      message: 'Status updated successfully'
    });
  } catch (error) {
    console.error('Error updating status:', error);
    if (error instanceof Error && error.message.includes('blocking dependencies')) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
    }
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update status'
    });
  }
});

// B-406: Update priority and urgency
router.patch('/:id/priority', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const data: UpdateRequirementPriorityRequest = req.body;

    // Validate priority
    if (data.priority !== undefined && (data.priority < 1 || data.priority > 5)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Priority must be between 1 (highest) and 5 (lowest)'
      });
    }

    // Validate priority_label
    if (data.priority_label && !['critical', 'high', 'medium', 'low', 'backlog'].includes(data.priority_label)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Priority label must be one of: critical, high, medium, low, backlog'
      });
    }

    // Check if user can modify this requirement
    const canModify = await RequirementModel.canUserModify(id, user.id);
    if (!canModify) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to modify this requirement'
      });
    }

    const requirement = await RequirementModel.updatePriority(id, data, user.id);
    if (!requirement) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Requirement not found'
      });
    }

    res.json({
      requirement,
      message: 'Priority updated successfully'
    });
  } catch (error) {
    console.error('Error updating priority:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update priority'
    });
  }
});

// B-407: Update lifecycle (estimates, story points, labels, metadata)
router.patch('/:id/lifecycle', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const data: UpdateRequirementLifecycleRequest = req.body;

    // Check if user can modify this requirement
    const canModify = await RequirementModel.canUserModify(id, user.id);
    if (!canModify) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to modify this requirement'
      });
    }

    const requirement = await RequirementModel.updateLifecycle(id, data, user.id);
    if (!requirement) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Requirement not found'
      });
    }

    res.json({
      requirement,
      message: 'Lifecycle information updated successfully'
    });
  } catch (error) {
    console.error('Error updating lifecycle:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update lifecycle information'
    });
  }
});

// Comment management endpoints

// Get comments for a requirement
router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user can access this requirement
    const canAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!canAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const comments = await RequirementCommentModel.findByRequirementId(id);

    res.json({
      comments,
      total: comments.length
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch comments'
    });
  }
});

// Create a comment
router.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const data: CreateRequirementCommentRequest = req.body;

    if (!data.content || data.content.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Comment content is required'
      });
    }

    // Check if user can access this requirement
    const canAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!canAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const comment = await RequirementCommentModel.create(id, user.id, data);
    const commentWithAuthor = await RequirementCommentModel.findByIdWithAuthor(comment.id);

    res.status(201).json({
      comment: commentWithAuthor,
      message: 'Comment created successfully'
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create comment'
    });
  }
});

// Watcher management endpoints

// Get watchers for a requirement
router.get('/:id/watchers', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user can access this requirement
    const canAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!canAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const watchers = await RequirementWatcherModel.findByRequirementId(id);

    res.json({
      watchers,
      total: watchers.length
    });
  } catch (error) {
    console.error('Error fetching watchers:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch watchers'
    });
  }
});

// Add watcher to requirement
router.post('/:id/watchers', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const data: AddRequirementWatcherRequest = req.body;

    // Check if user can access this requirement
    const canAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!canAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const watcher = await RequirementWatcherModel.addWatcher(
      id,
      user.id,
      data.watch_type || 'all'
    );

    res.status(201).json({
      watcher,
      message: 'Watcher added successfully'
    });
  } catch (error) {
    console.error('Error adding watcher:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to add watcher'
    });
  }
});

// Remove watcher from requirement
router.delete('/:id/watchers', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user can access this requirement
    const canAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!canAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const removed = await RequirementWatcherModel.removeWatcher(id, user.id);
    if (!removed) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'You are not watching this requirement'
      });
    }

    res.json({
      message: 'Watcher removed successfully'
    });
  } catch (error) {
    console.error('Error removing watcher:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to remove watcher'
    });
  }
});

// Dependency management endpoints

// Get dependencies for a requirement
router.get('/:id/dependencies', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user can access this requirement
    const canAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!canAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const { dependencies, blocking } = await RequirementDependencyModel.findAllRelated(id);

    res.json({
      dependencies, // Things that block this requirement
      blocking,     // Things this requirement blocks
      dependency_count: dependencies.length,
      blocking_count: blocking.length
    });
  } catch (error) {
    console.error('Error fetching dependencies:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch dependencies'
    });
  }
});

// Create a dependency
router.post('/:id/dependencies', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const data: CreateRequirementDependencyRequest = req.body;

    // Check if user can modify this requirement
    const canModify = await RequirementModel.canUserModify(id, user.id);
    if (!canModify) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to modify this requirement'
      });
    }

    // Check if dependency requirement exists and user has access to it
    const canAccessDependency = await RequirementModel.canUserAccess(data.dependency_id, user.id);
    if (!canAccessDependency) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to the dependency requirement'
      });
    }

    const dependency = await RequirementDependencyModel.create(
      id,
      data.dependency_id,
      data.dependency_type,
      user.id
    );

    res.status(201).json({
      dependency,
      message: 'Dependency created successfully'
    });
  } catch (error) {
    console.error('Error creating dependency:', error);
    if (error instanceof Error && error.message.includes('circular dependency')) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
    }
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create dependency'
    });
  }
});

// Remove a dependency
router.delete('/:id/dependencies/:dependencyId', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id, dependencyId } = req.params;
    const { dependency_type } = req.query;

    // Check if user can modify this requirement
    const canModify = await RequirementModel.canUserModify(id, user.id);
    if (!canModify) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to modify this requirement'
      });
    }

    const removed = await RequirementDependencyModel.remove(
      id,
      dependencyId,
      dependency_type as any
    );

    if (!removed) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Dependency not found'
      });
    }

    res.json({
      message: 'Dependency removed successfully'
    });
  } catch (error) {
    console.error('Error removing dependency:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to remove dependency'
    });
  }
});

// Get requirement history
router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user can access this requirement
    const canAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!canAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const history = await RequirementHistoryModel.findByRequirementId(id);

    res.json({
      history,
      total: history.length
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch history'
    });
  }
});

// Get requirements assigned to current user
router.get('/assigned/me', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const requirements = await RequirementModel.findByAssignee(user.id);

    res.json({
      requirements,
      total: requirements.length
    });
  } catch (error) {
    console.error('Error fetching assigned requirements:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch assigned requirements'
    });
  }
});

export default router;