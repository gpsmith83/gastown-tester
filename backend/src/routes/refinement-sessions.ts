import { Router, Request, Response } from 'express';
import { requireAuth } from '../config/auth';
import { RefinementSessionModel, RefinementMessageModel } from '../models/RefinementSession';
import { RequirementModel } from '../models/Requirement';
import { CreateRefinementSessionRequest, CreateRefinementMessageRequest } from '../models/types';
import { User } from '../models/types';

const router = Router();

// All refinement session routes require authentication
router.use(requireAuth);

// Get user's refinement sessions (across all projects they have access to)
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const sessions = await RefinementSessionModel.findByUserId(user.id);

    res.json({
      sessions,
      total: sessions.length
    });
  } catch (error) {
    console.error('Error fetching refinement sessions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch refinement sessions'
    });
  }
});

// Get refinement sessions for a specific requirement
router.get('/requirement/:requirementId', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { requirementId } = req.params;

    // Check if user has access to this requirement
    const hasAccess = await RequirementModel.canUserAccess(requirementId, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const sessions = await RefinementSessionModel.findByRequirementId(requirementId);

    res.json({
      sessions,
      requirement_id: requirementId,
      total: sessions.length
    });
  } catch (error) {
    console.error('Error fetching requirement refinement sessions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch requirement refinement sessions'
    });
  }
});

// Create new refinement session
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const data: CreateRefinementSessionRequest = req.body;

    // Basic validation
    if (!data.requirement_id) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'requirement_id is required'
      });
    }

    // Check if user has access to the requirement
    const hasAccess = await RequirementModel.canUserAccess(data.requirement_id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    // Clean up data
    const cleanData: CreateRefinementSessionRequest = {
      requirement_id: data.requirement_id,
      session_name: data.session_name?.trim(),
      status: data.status || 'active',
      session_metadata: data.session_metadata || {}
    };

    const session = await RefinementSessionModel.create(cleanData, user.id);

    // Return session with full details
    const sessionWithDetails = await RefinementSessionModel.findByIdWithDetails(session.id);

    res.status(201).json({
      session: sessionWithDetails,
      message: 'Refinement session created successfully'
    });
  } catch (error) {
    console.error('Error creating refinement session:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create refinement session'
    });
  }
});

// Get specific refinement session
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user has access to this session
    const hasAccess = await RefinementSessionModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this refinement session'
      });
    }

    const session = await RefinementSessionModel.findByIdWithDetails(id);
    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Refinement session not found'
      });
    }

    res.json({
      session
    });
  } catch (error) {
    console.error('Error fetching refinement session:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch refinement session'
    });
  }
});

// Update refinement session
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const data: Partial<CreateRefinementSessionRequest> = req.body;

    // Check if user has access to this session
    const hasAccess = await RefinementSessionModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this refinement session'
      });
    }

    // Clean up data
    if (data.session_name) data.session_name = data.session_name.trim();

    const session = await RefinementSessionModel.update(id, data);
    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Refinement session not found'
      });
    }

    // Return updated session with full details
    const sessionWithDetails = await RefinementSessionModel.findByIdWithDetails(session.id);

    res.json({
      session: sessionWithDetails,
      message: 'Refinement session updated successfully'
    });
  } catch (error) {
    console.error('Error updating refinement session:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update refinement session'
    });
  }
});

// Update refinement session status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'completed', 'archived'].includes(status)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid status. Must be active, completed, or archived'
      });
    }

    // Check if user has access to this session
    const hasAccess = await RefinementSessionModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this refinement session'
      });
    }

    const session = await RefinementSessionModel.updateStatus(id, status);
    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Refinement session not found'
      });
    }

    res.json({
      session,
      message: `Refinement session status updated to ${status} successfully`
    });
  } catch (error) {
    console.error('Error updating refinement session status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update refinement session status'
    });
  }
});

// Get messages for a refinement session
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user has access to this session
    const hasAccess = await RefinementSessionModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this refinement session'
      });
    }

    const messages = await RefinementMessageModel.findBySessionIdWithUsers(id);

    res.json({
      messages,
      session_id: id,
      total: messages.length
    });
  } catch (error) {
    console.error('Error fetching refinement session messages:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch refinement session messages'
    });
  }
});

// Add message to refinement session
router.post('/:id/messages', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const data: CreateRefinementMessageRequest = req.body;

    // Check if user has access to this session
    const hasAccess = await RefinementSessionModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this refinement session'
      });
    }

    // Basic validation
    if (!data.message_type || !data.content) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'message_type and content are required'
      });
    }

    if (!['user_message', 'ai_response', 'system_message'].includes(data.message_type)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid message_type. Must be user_message, ai_response, or system_message'
      });
    }

    // Clean up data
    const cleanData: CreateRefinementMessageRequest = {
      session_id: id,
      message_type: data.message_type,
      content: data.content.trim(),
      message_metadata: data.message_metadata || {}
    };

    const message = await RefinementMessageModel.create(cleanData, user.id);

    res.status(201).json({
      message,
      session_id: id,
      message: 'Refinement message created successfully'
    });
  } catch (error) {
    console.error('Error creating refinement message:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create refinement message'
    });
  }
});

export default router;