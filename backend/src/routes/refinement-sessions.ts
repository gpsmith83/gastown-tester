import express, { Request, Response } from 'express';
import { RefinementSessionModel } from '../models/RefinementSession';
import { RequirementModel } from '../models/Requirement';
import { CreateRefinementSessionRequest, UpdateRefinementSessionRequest } from '../models/types';

const router = express.Router();

/**
 * GET /refinement-sessions
 * Get all refinement sessions accessible to the current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessions = await RefinementSessionModel.findAccessibleByUser(userId);

    res.json({
      sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('[REFINEMENT_SESSIONS] Error fetching sessions:', error);
    res.status(500).json({
      error: 'Failed to fetch refinement sessions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /refinement-sessions/:id
 * Get a specific refinement session by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const session = await RefinementSessionModel.findByIdWithDetails(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Refinement session not found' });
    }

    // Check if user has access
    const hasAccess = await RefinementSessionModel.canUserAccess(session.id, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(session);
  } catch (error) {
    console.error('[REFINEMENT_SESSIONS] Error fetching session:', error);
    res.status(500).json({
      error: 'Failed to fetch refinement session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /refinement-sessions/requirement/:requirementId
 * Get all refinement sessions for a specific requirement
 */
router.get('/requirement/:requirementId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const requirementId = req.params.requirementId;

    // Check if user has access to the requirement
    const hasRequirementAccess = await RequirementModel.canUserAccess(requirementId, userId);
    if (!hasRequirementAccess) {
      return res.status(403).json({ error: 'Requirement access denied' });
    }

    const sessions = await RefinementSessionModel.findByRequirementId(requirementId);

    res.json({
      sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('[REFINEMENT_SESSIONS] Error fetching requirement sessions:', error);
    res.status(500).json({
      error: 'Failed to fetch requirement refinement sessions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /refinement-sessions
 * Create a new refinement session
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const data: CreateRefinementSessionRequest = req.body;

    // Validate required fields
    if (!data.requirement_id) {
      return res.status(400).json({
        error: 'Missing required field: requirement_id'
      });
    }

    // Check if user has access to the requirement
    const hasRequirementAccess = await RequirementModel.canUserAccess(data.requirement_id, userId);
    if (!hasRequirementAccess) {
      return res.status(403).json({ error: 'Requirement access denied' });
    }

    // Create the refinement session
    const session = await RefinementSessionModel.create(data, userId);

    res.status(201).json({
      message: 'Refinement session created successfully',
      session
    });
  } catch (error) {
    console.error('[REFINEMENT_SESSIONS] Error creating session:', error);
    res.status(500).json({
      error: 'Failed to create refinement session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PATCH /refinement-sessions/:id
 * Update a refinement session
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionId = req.params.id;
    const data: UpdateRefinementSessionRequest = req.body;

    // Check if session exists
    const existing = await RefinementSessionModel.findById(sessionId);
    if (!existing) {
      return res.status(404).json({ error: 'Refinement session not found' });
    }

    // Check if user has access (session owner or requirement access)
    const hasAccess = await RefinementSessionModel.canUserAccess(sessionId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update the session
    const updated = await RefinementSessionModel.update(sessionId, data);
    if (!updated) {
      return res.status(500).json({ error: 'Failed to update refinement session' });
    }

    res.json({
      message: 'Refinement session updated successfully',
      session: updated
    });
  } catch (error) {
    console.error('[REFINEMENT_SESSIONS] Error updating session:', error);
    res.status(500).json({
      error: 'Failed to update refinement session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /refinement-sessions/:id
 * Delete a refinement session
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionId = req.params.id;

    // Check if session exists
    const existing = await RefinementSessionModel.findById(sessionId);
    if (!existing) {
      return res.status(404).json({ error: 'Refinement session not found' });
    }

    // Check if user owns the session (only owner can delete)
    const isOwner = await RefinementSessionModel.isUserOwner(sessionId, userId);
    if (!isOwner) {
      return res.status(403).json({
        error: 'Only session owners can delete refinement sessions'
      });
    }

    // Delete the session
    const deleted = await RefinementSessionModel.delete(sessionId);
    if (!deleted) {
      return res.status(500).json({ error: 'Failed to delete refinement session' });
    }

    res.json({
      message: 'Refinement session deleted successfully'
    });
  } catch (error) {
    console.error('[REFINEMENT_SESSIONS] Error deleting session:', error);
    res.status(500).json({
      error: 'Failed to delete refinement session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;