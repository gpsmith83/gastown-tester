import { Router, Request, Response } from 'express';
import { requireAuth } from '../config/auth';
import { ProjectModel } from '../models/Project';
import { LinearConnectionModel } from '../models/LinearConnection';
import { LinearService } from '../services/LinearService';
import { SecretManager } from '../services/SecretManager';
import {
  User,
  CreateLinearConnectionRequest,
  UpdateLinearConnectionRequest
} from '../models/types';

const router = Router();

// All Linear routes require authentication
router.use(requireAuth);

// Get Linear connection for a project
router.get('/projects/:projectId/connection', async (req: Request, res: Response) => {
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

    const connection = await LinearConnectionModel.findByProjectId(projectId);
    if (!connection) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No Linear connection found for this project'
      });
    }

    // Don't return sensitive token hash in response
    const { api_token_hash, ...connectionData } = connection;

    res.json({
      connection: connectionData
    });
  } catch (error) {
    console.error('[LINEAR_ROUTES] Error fetching Linear connection:', SecretManager.redactSensitiveData(error));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch Linear connection'
    });
  }
});

// Create Linear connection for a project
router.post('/projects/:projectId/connection', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { projectId } = req.params;
    const data: CreateLinearConnectionRequest = req.body;

    // Check if user owns this project (only owners can configure integrations)
    const isOwner = await ProjectModel.isUserOwner(projectId, user.id);
    if (!isOwner) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'Only project owners can configure Linear integrations'
      });
    }

    // Validate required fields
    if (!data.api_token || !data.workspace_id || !data.team_id) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'API token, workspace ID, and team ID are required'
      });
    }

    // Check if Linear connection already exists for this project
    const existingConnection = await LinearConnectionModel.findByProjectId(projectId);
    if (existingConnection) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Linear connection already exists for this project. Use PUT to update.'
      });
    }

    // Validate the Linear connection
    const validationResult = await LinearService.validateConnection(
      data.api_token,
      data.workspace_id,
      data.team_id,
      data.board_id,
      data.project_id_linear
    );

    if (!validationResult.is_valid) {
      return res.status(400).json({
        error: 'Validation Error',
        message: validationResult.error
      });
    }

    // Create the Linear connection
    const connection = await LinearConnectionModel.create(projectId, data);

    // Update validation status with the validation result
    await LinearConnectionModel.updateValidation(projectId, validationResult);

    // Fetch updated connection without sensitive data
    const updatedConnection = await LinearConnectionModel.findByProjectId(projectId);
    const { api_token_hash, ...connectionData } = updatedConnection!;

    res.status(201).json({
      connection: connectionData,
      message: 'Linear connection created and validated successfully'
    });
  } catch (error) {
    console.error('[LINEAR_ROUTES] Error creating Linear connection:', SecretManager.redactSensitiveData({
      error,
      projectId: req.params.projectId,
      // Don't log the request body as it contains the API token
      hasRequestBody: !!req.body
    }));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create Linear connection'
    });
  }
});

// Update Linear connection for a project
router.put('/projects/:projectId/connection', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { projectId } = req.params;
    const data: UpdateLinearConnectionRequest = req.body;

    // Check if user owns this project
    const isOwner = await ProjectModel.isUserOwner(projectId, user.id);
    if (!isOwner) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'Only project owners can update Linear integrations'
      });
    }

    const existingConnection = await LinearConnectionModel.findByProjectId(projectId);
    if (!existingConnection) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No Linear connection found for this project'
      });
    }

    // Update the connection
    const updatedConnection = await LinearConnectionModel.update(projectId, data);
    if (!updatedConnection) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Linear connection not found'
      });
    }

    // Don't return sensitive token hash in response
    const { api_token_hash, ...connectionData } = updatedConnection;

    res.json({
      connection: connectionData,
      message: 'Linear connection updated successfully. Re-validation needed.'
    });
  } catch (error) {
    console.error('[LINEAR_ROUTES] Error updating Linear connection:', SecretManager.redactSensitiveData({
      error,
      projectId: req.params.projectId,
      updateData: SecretManager.redactSensitiveData(req.body)
    }));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update Linear connection'
    });
  }
});

// Validate Linear connection for a project
router.post('/projects/:projectId/connection/validate', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { projectId } = req.params;
    const { api_token } = req.body;

    // Check if user has access to this project
    const hasAccess = await ProjectModel.canUserAccess(projectId, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    const connection = await LinearConnectionModel.findByProjectId(projectId);
    if (!connection) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No Linear connection found for this project'
      });
    }

    // Require API token for validation
    if (!api_token) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'API token is required for validation'
      });
    }

    // Verify the token matches the stored connection
    const tokenValid = await LinearConnectionModel.verifyToken(projectId, api_token);
    if (!tokenValid) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Provided API token does not match stored connection'
      });
    }

    // Validate the connection with Linear API
    const validationResult = await LinearService.validateConnection(
      api_token,
      connection.workspace_id,
      connection.team_id,
      connection.board_id || undefined,
      connection.project_id_linear || undefined
    );

    // Update validation status
    await LinearConnectionModel.updateValidation(projectId, validationResult);

    res.json({
      validation_result: validationResult,
      message: validationResult.is_valid
        ? 'Linear connection validated successfully'
        : 'Linear connection validation failed'
    });
  } catch (error) {
    console.error('[LINEAR_ROUTES] Error validating Linear connection:', SecretManager.redactSensitiveData({
      error,
      projectId: req.params.projectId,
      // Don't log the request body as it contains the API token
      hasApiToken: !!req.body.api_token
    }));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate Linear connection'
    });
  }
});

// Delete Linear connection for a project
router.delete('/projects/:projectId/connection', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { projectId } = req.params;

    // Check if user owns this project
    const isOwner = await ProjectModel.isUserOwner(projectId, user.id);
    if (!isOwner) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'Only project owners can delete Linear integrations'
      });
    }

    const deleted = await LinearConnectionModel.delete(projectId);
    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No Linear connection found for this project'
      });
    }

    res.json({
      message: 'Linear connection deleted successfully'
    });
  } catch (error) {
    console.error('[LINEAR_ROUTES] Error deleting Linear connection:', SecretManager.redactSensitiveData({
      error,
      projectId: req.params.projectId
    }));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete Linear connection'
    });
  }
});

export default router;