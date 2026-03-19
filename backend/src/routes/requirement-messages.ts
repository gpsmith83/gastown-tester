import express, { Request, Response } from 'express';
import { RequirementMessageModel } from '../models/RequirementMessage';
import { RefinementSessionModel } from '../models/RefinementSession';
import { CreateRequirementMessageRequest, UpdateRequirementMessageRequest } from '../models/types';

const router = express.Router();

/**
 * GET /requirement-messages/session/:sessionId
 * Get all messages for a specific session in chronological order
 */
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionId = req.params.sessionId;

    // Check if user has access to the session
    const hasSessionAccess = await RefinementSessionModel.canUserAccess(sessionId, userId);
    if (!hasSessionAccess) {
      return res.status(403).json({ error: 'Session access denied' });
    }

    const messages = await RequirementMessageModel.findBySessionId(sessionId);

    res.json({
      messages,
      count: messages.length
    });
  } catch (error) {
    console.error('[REQUIREMENT_MESSAGES] Error fetching session messages:', error);
    res.status(500).json({
      error: 'Failed to fetch session messages',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /requirement-messages/requirement/:requirementId
 * Get all messages for a requirement across all sessions
 */
router.get('/requirement/:requirementId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const requirementId = req.params.requirementId;

    // Check if user has access to the requirement (will be checked in the model query)
    const messages = await RequirementMessageModel.findByRequirementId(requirementId);

    // Filter messages based on user access (additional security layer)
    const accessibleMessages = [];
    for (const message of messages) {
      const hasAccess = await RequirementMessageModel.canUserAccess(message.id, userId);
      if (hasAccess) {
        accessibleMessages.push(message);
      }
    }

    res.json({
      messages: accessibleMessages,
      count: accessibleMessages.length
    });
  } catch (error) {
    console.error('[REQUIREMENT_MESSAGES] Error fetching requirement messages:', error);
    res.status(500).json({
      error: 'Failed to fetch requirement messages',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /requirement-messages/:id
 * Get a specific message by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const message = await RequirementMessageModel.findByIdWithDetails(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user has access
    const hasAccess = await RequirementMessageModel.canUserAccess(message.id, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get replies to this message
    const replies = await RequirementMessageModel.findReplies(message.id);

    res.json({
      ...message,
      replies
    });
  } catch (error) {
    console.error('[REQUIREMENT_MESSAGES] Error fetching message:', error);
    res.status(500).json({
      error: 'Failed to fetch message',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /requirement-messages
 * Create a new requirement message
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const data: CreateRequirementMessageRequest = req.body;

    // Validate required fields
    if (!data.requirement_id || !data.session_id || !data.content) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['requirement_id', 'session_id', 'content']
      });
    }

    // Check if user has access to the session
    const hasSessionAccess = await RefinementSessionModel.canUserAccess(data.session_id, userId);
    if (!hasSessionAccess) {
      return res.status(403).json({ error: 'Session access denied' });
    }

    // Create the message
    const message = await RequirementMessageModel.create(data, userId);

    res.status(201).json({
      message: 'Requirement message created successfully',
      data: message
    });
  } catch (error) {
    console.error('[REQUIREMENT_MESSAGES] Error creating message:', error);
    res.status(500).json({
      error: 'Failed to create requirement message',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PATCH /requirement-messages/:id
 * Update a requirement message
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const messageId = req.params.id;
    const data: UpdateRequirementMessageRequest = req.body;

    // Check if message exists
    const existing = await RequirementMessageModel.findById(messageId);
    if (!existing) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is the author (only author can edit messages)
    const isAuthor = await RequirementMessageModel.isUserAuthor(messageId, userId);
    if (!isAuthor) {
      return res.status(403).json({
        error: 'Only message authors can edit their messages'
      });
    }

    // Update the message
    const updated = await RequirementMessageModel.update(messageId, data);
    if (!updated) {
      return res.status(500).json({ error: 'Failed to update message' });
    }

    res.json({
      message: 'Requirement message updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('[REQUIREMENT_MESSAGES] Error updating message:', error);
    res.status(500).json({
      error: 'Failed to update requirement message',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /requirement-messages/:id
 * Delete a requirement message
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const messageId = req.params.id;

    // Check if message exists
    const existing = await RequirementMessageModel.findById(messageId);
    if (!existing) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is the author (only author can delete messages)
    const isAuthor = await RequirementMessageModel.isUserAuthor(messageId, userId);
    if (!isAuthor) {
      return res.status(403).json({
        error: 'Only message authors can delete their messages'
      });
    }

    // Delete the message
    const deleted = await RequirementMessageModel.delete(messageId);
    if (!deleted) {
      return res.status(500).json({ error: 'Failed to delete message' });
    }

    res.json({
      message: 'Requirement message deleted successfully'
    });
  } catch (error) {
    console.error('[REQUIREMENT_MESSAGES] Error deleting message:', error);
    res.status(500).json({
      error: 'Failed to delete requirement message',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;