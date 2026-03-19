import express, { Request, Response } from 'express';
import { requireAuth } from '../config/auth';
import { RefinementSessionModel, RefinementMessageModel } from '../models/RefinementSession';
import { RequirementModel } from '../models/Requirement';
import {
  CreateRefinementSessionRequest,
  UpdateRefinementSessionRequest,
  CreateRefinementMessageRequest,
  User
} from '../models/types';

const router = express.Router();

// All refinement session routes require authentication
router.use(requireAuth);

/**
 * GET /refinement-sessions
 * Get all refinement sessions accessible to the current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;

    // Get sessions accessible to the user (via workspace membership)
    const sessions = await RefinementSessionModel.findAccessibleByUser(user.id);

    res.json({
      success: true,
      data: sessions,
      total: sessions.length
    });
  } catch (error) {
    console.error('Error fetching refinement sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch refinement sessions'
    });
  }
});

/**
 * GET /refinement-sessions/by-requirement/:requirementId
 * Get all refinement sessions for a specific requirement
 */
router.get('/by-requirement/:requirementId', async (req: Request, res: Response) => {
  try {
    const { requirementId } = req.params;
    const user = req.user as User;

    // Verify user can access this requirement
    const requirement = await RequirementModel.findById(requirementId);
    if (!requirement) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Requirement not found'
      });
    }

    const canAccess = await RequirementModel.canUserAccess(requirementId, user.id);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access denied to this requirement'
      });
    }

    const sessions = await RefinementSessionModel.findByRequirementId(requirementId);

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Error fetching requirement refinement sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch refinement sessions'
    });
  }
});

/**
 * GET /refinement-sessions/:id
 * Get a specific refinement session by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as User;

    // Check if user can access this session
    const canAccess = await RefinementSessionModel.canUserAccess(id, user.id);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access denied to this refinement session'
      });
    }

    const session = await RefinementSessionModel.findByIdWithDetails(id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Refinement session not found'
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error fetching refinement session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch refinement session'
    });
  }
});

/**
 * POST /refinement-sessions
 * Create a new refinement session
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const sessionData: CreateRefinementSessionRequest = req.body;

    // Validate required fields
    if (!sessionData.requirement_id) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'requirement_id is required'
      });
    }

    // Verify user can access the requirement
    const canAccess = await RequirementModel.canUserAccess(sessionData.requirement_id, user.id);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access denied to this requirement'
      });
    }

    // Verify requirement exists
    const requirement = await RequirementModel.findById(sessionData.requirement_id);
    if (!requirement) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Requirement not found'
      });
    }

    // Create the session
    const session = await RefinementSessionModel.create(sessionData, user.id);

    // Fetch the session with full details
    const sessionWithDetails = await RefinementSessionModel.findByIdWithDetails(session.id);

    res.status(201).json({
      success: true,
      data: sessionWithDetails
    });
  } catch (error) {
    console.error('Error creating refinement session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create refinement session'
    });
  }
});

/**
 * PUT /refinement-sessions/:id
 * Update a refinement session
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as User;
    const updateData: UpdateRefinementSessionRequest = req.body;

    // Check if user can access this session
    const canAccess = await RefinementSessionModel.canUserAccess(id, user.id);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access denied to this refinement session'
      });
    }

    // Check if user is the owner (only owners can update)
    const isOwner = await RefinementSessionModel.isUserOwner(id, user.id);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only the session owner can update this session'
      });
    }

    // Update the session
    const updatedSession = await RefinementSessionModel.update(id, updateData);
    if (!updatedSession) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Refinement session not found'
      });
    }

    // Fetch with full details
    const sessionWithDetails = await RefinementSessionModel.findByIdWithDetails(id);

    res.json({
      success: true,
      data: sessionWithDetails
    });
  } catch (error) {
    console.error('Error updating refinement session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update refinement session'
    });
  }
});

/**
 * DELETE /refinement-sessions/:id
 * Delete a refinement session
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as User;

    // Check if user is the owner (only owners can delete)
    const isOwner = await RefinementSessionModel.isUserOwner(id, user.id);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only the session owner can delete this session'
      });
    }

    const success = await RefinementSessionModel.delete(id);
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Refinement session not found'
      });
    }

    res.json({
      success: true,
      message: 'Refinement session deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting refinement session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to delete refinement session'
    });
  }
});

/**
 * GET /refinement-sessions/:id/messages
 * Get all messages for a refinement session
 */
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as User;

    // Check if user can access this session
    const canAccess = await RefinementSessionModel.canUserAccess(id, user.id);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access denied to this refinement session'
      });
    }

    const messages = await RefinementMessageModel.findBySessionIdWithUsers(id);

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Error fetching refinement messages:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch refinement messages'
    });
  }
});

/**
 * POST /refinement-sessions/:id/messages
 * Add a message to a refinement session
 */
router.post('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as User;
    const messageData: CreateRefinementMessageRequest = req.body;

    // Check if user can access this session
    const canAccess = await RefinementSessionModel.canUserAccess(id, user.id);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access denied to this refinement session'
      });
    }

    // Validate required fields
    if (!messageData.content || !messageData.message_type) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'content and message_type are required'
      });
    }

    // Set the session_id from the URL parameter
    messageData.session_id = id;

    // Create the message
    const message = await RefinementMessageModel.create(messageData, user.id);

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error creating refinement message:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create refinement message'
    });
  }
});

/**
 * GET /refinement-sessions/my/sessions
 * Get refinement sessions created by the current user
 */
router.get('/my/sessions', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const sessions = await RefinementSessionModel.findByUserId(user.id);

    res.json({
      success: true,
      data: sessions,
      total: sessions.length
    });
  } catch (error) {
    console.error('Error fetching user refinement sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch user refinement sessions'
    });
  }
});

export default router;