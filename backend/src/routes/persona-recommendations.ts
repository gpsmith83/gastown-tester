import { Router, Request, Response } from 'express';
import { PersonaProgressionService } from '../services/PersonaProgressionService';
import {
  GetPersonaRecommendationRequest,
  User
} from '../models/types';
import { requireAuth } from '../config/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

/**
 * Get persona recommendation for a requirement
 * POST /api/persona-recommendations/recommend
 */
router.post('/recommend', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const requestData = req.body as GetPersonaRecommendationRequest;

    // Validate required fields
    if (!requestData.requirement_id) {
      return res.status(400).json({
        error: 'Missing required field: requirement_id'
      });
    }

    console.log(`[PERSONA_RECOMMENDATIONS] Getting recommendation for requirement ${requestData.requirement_id} by user ${user.id}`);

    // Get persona recommendation
    const response = await PersonaProgressionService.getPersonaRecommendation(requestData);

    if (response.error) {
      return res.status(400).json({
        error: response.error,
        fallback_reason: response.fallback_reason
      });
    }

    if (!response.recommendation) {
      return res.status(404).json({
        error: 'No recommendation could be generated',
        fallback_reason: response.fallback_reason
      });
    }

    console.log(`[PERSONA_RECOMMENDATIONS] Generated recommendation: ${response.recommendation.recommended_persona.persona_name} for requirement ${requestData.requirement_id}`);

    res.json(response);
  } catch (error) {
    console.error('[PERSONA_RECOMMENDATIONS] Error getting recommendation:', error);
    res.status(500).json({ error: 'Failed to generate persona recommendation' });
  }
});

/**
 * Get persona recommendation for a requirement (GET method for convenience)
 * GET /api/persona-recommendations/:requirement_id
 */
router.get('/:requirement_id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { requirement_id } = req.params;
    const session_id = req.query.session_id as string;

    console.log(`[PERSONA_RECOMMENDATIONS] Getting recommendation for requirement ${requirement_id} by user ${user.id}`);

    const requestData: GetPersonaRecommendationRequest = {
      requirement_id,
      session_id,
      current_context: req.query.context ? JSON.parse(req.query.context as string) : undefined
    };

    // Get persona recommendation
    const response = await PersonaProgressionService.getPersonaRecommendation(requestData);

    if (response.error) {
      return res.status(400).json({
        error: response.error,
        fallback_reason: response.fallback_reason
      });
    }

    if (!response.recommendation) {
      return res.status(404).json({
        error: 'No recommendation could be generated',
        fallback_reason: response.fallback_reason
      });
    }

    console.log(`[PERSONA_RECOMMENDATIONS] Generated recommendation: ${response.recommendation.recommended_persona.persona_name} for requirement ${requirement_id}`);

    res.json(response);
  } catch (error) {
    console.error('[PERSONA_RECOMMENDATIONS] Error getting recommendation:', error);
    res.status(500).json({ error: 'Failed to generate persona recommendation' });
  }
});

/**
 * Health check endpoint for persona recommendation service
 * GET /api/persona-recommendations/health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    res.json({
      service: 'PersonaRecommendationService',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  } catch (error) {
    console.error('[PERSONA_RECOMMENDATIONS] Health check error:', error);
    res.status(500).json({
      service: 'PersonaRecommendationService',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;