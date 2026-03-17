import { Router, Request, Response } from 'express';
import { requireAuth } from '../config/auth';
import { WorkspaceModel } from '../models/Workspace';
import { CreateWorkspaceRequest } from '../models/types';
import { User } from '../models/types';

const router = Router();

// All workspace routes require authentication
router.use(requireAuth);

// Get user's workspaces
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const workspaces = await WorkspaceModel.findByUserId(user.id);

    res.json({
      workspaces,
      total: workspaces.length
    });
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch workspaces'
    });
  }
});

// Create new workspace
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const data: CreateWorkspaceRequest = req.body;

    // Basic validation
    if (!data.name || data.name.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Workspace name is required'
      });
    }

    if (data.name.length > 255) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Workspace name must be 255 characters or less'
      });
    }

    const workspace = await WorkspaceModel.create({
      name: data.name.trim(),
      description: data.description?.trim()
    }, user.id);

    res.status(201).json({
      workspace,
      message: 'Workspace created successfully'
    });
  } catch (error) {
    console.error('Error creating workspace:', error);

    // Handle specific database errors
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') { // Unique constraint violation
      return res.status(400).json({
        error: 'Validation Error',
        message: 'A workspace with this name already exists'
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create workspace'
    });
  }
});

// Get specific workspace
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user has access to this workspace
    const membership = await WorkspaceModel.isUserMember(id, user.id);
    if (!membership) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this workspace'
      });
    }

    const workspace = await WorkspaceModel.findById(id);
    if (!workspace) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Workspace not found'
      });
    }

    // Get workspace members
    const members = await WorkspaceModel.getMembers(id);

    res.json({
      workspace: {
        ...workspace,
        members
      }
    });
  } catch (error) {
    console.error('Error fetching workspace:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch workspace'
    });
  }
});

// Update workspace
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const data: Partial<CreateWorkspaceRequest> = req.body;

    // Check if user has access to this workspace
    const membership = await WorkspaceModel.isUserMember(id, user.id);
    if (!membership) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this workspace'
      });
    }

    // Only owners and admins can update workspace
    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to update this workspace'
      });
    }

    // Basic validation
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Workspace name is required'
        });
      }

      if (data.name.length > 255) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Workspace name must be 255 characters or less'
        });
      }

      data.name = data.name.trim();
    }

    if (data.description !== undefined) {
      data.description = data.description?.trim();
    }

    const workspace = await WorkspaceModel.update(id, data);
    if (!workspace) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Workspace not found'
      });
    }

    res.json({
      workspace,
      message: 'Workspace updated successfully'
    });
  } catch (error) {
    console.error('Error updating workspace:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update workspace'
    });
  }
});

// Delete workspace
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user is the owner of this workspace
    const membership = await WorkspaceModel.isUserMember(id, user.id);
    if (!membership || membership.role !== 'owner') {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'Only workspace owners can delete the workspace'
      });
    }

    const deleted = await WorkspaceModel.delete(id);
    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Workspace not found'
      });
    }

    res.json({
      message: 'Workspace deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete workspace'
    });
  }
});

export default router;