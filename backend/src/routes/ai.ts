import express, { Request, Response } from 'express';
import { globalAIService, AICompletionRequest } from '../services/ai-provider';

const router = express.Router();

/**
 * GET /ai/health
 * Check AI provider health status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const isHealthy = await globalAIService.isHealthy();
    const providerInfo = globalAIService.getProviderInfo();

    res.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      provider: providerInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /ai/complete
 * Send a completion request to the AI provider
 */
router.post('/complete', async (req: Request, res: Response) => {
  try {
    const request: AICompletionRequest = req.body;

    // Basic validation
    if (!request.messages || !Array.isArray(request.messages)) {
      return res.status(400).json({
        error: 'Invalid request: messages array is required',
      });
    }

    if (request.messages.length === 0) {
      return res.status(400).json({
        error: 'Invalid request: at least one message is required',
      });
    }

    // Extract user context for usage tracking
    const userId = (req as any).user?.id; // Assumes authentication middleware
    const projectId = req.headers['x-project-id'] as string;

    const response = await globalAIService.complete(request, {
      userId,
      projectId,
    });

    res.json(response);
  } catch (error) {
    console.error('[AI_ROUTE] Completion error:', error);

    if (error instanceof Error && error.name === 'AIProviderError') {
      return res.status(502).json({
        error: 'AI provider error',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /ai/usage/stats
 * Get AI usage statistics
 */
router.get('/usage/stats', async (req: Request, res: Response) => {
  try {
    const stats = globalAIService.getUsageStats();
    res.json({
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get usage stats',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /ai/usage/recent
 * Get recent AI usage entries
 */
router.get('/usage/recent', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const usage = globalAIService.getRecentUsage(limit);

    res.json({
      usage,
      count: usage.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get recent usage',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;