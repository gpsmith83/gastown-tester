import express, { Request, Response } from 'express';
import { globalAIService, AICompletionRequest } from '../services/ai-provider';
import { aiLogger } from '../utils/logger';
import { AIAuditService } from '../services/ai-audit-service';

const router = express.Router();

/**
 * GET /ai/health
 * Check AI provider health status
 */
router.get('/health', async (req: Request, res: Response) => {
  const logger = aiLogger.withRequest(req);

  try {
    logger.info('Checking AI provider health', { operation: 'ai_health_check' });

    const isHealthy = await globalAIService.isHealthy();
    const providerInfo = globalAIService.getProviderInfo();

    logger.info('AI provider health check completed', {
      operation: 'ai_health_check',
      healthy: isHealthy,
      provider: providerInfo?.type || 'unknown'
    });

    res.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      provider: providerInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('AI provider health check failed', {
      operation: 'ai_health_check',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /ai/complete
 * Send a completion request to the AI provider with full audit logging
 */
router.post('/complete', async (req: Request, res: Response) => {
  const logger = aiLogger.withRequest(req);

  try {
    const request: AICompletionRequest = req.body;

    logger.info('AI completion request received', {
      operation: 'ai_completion',
      messageCount: request.messages?.length || 0
    });

    // Basic validation
    if (!request.messages || !Array.isArray(request.messages)) {
      logger.warn('Invalid AI completion request: missing messages array', {
        operation: 'ai_completion',
        validationError: 'messages_required'
      });
      return res.status(400).json({
        error: 'Invalid request: messages array is required',
      });
    }

    if (request.messages.length === 0) {
      logger.warn('Invalid AI completion request: empty messages array', {
        operation: 'ai_completion',
        validationError: 'messages_empty'
      });
      return res.status(400).json({
        error: 'Invalid request: at least one message is required',
      });
    }

    // Extract context for audit logging
    const userId = (req as any).user?.id;
    const requirementId = req.headers['x-requirement-id'] as string;
    const correlationId = (req as any).correlationId; // From correlation middleware
    const jobId = req.headers['x-job-id'] as string;
    const auditLevel = (req.headers['x-audit-level'] as 'full' | 'metadata-only' | 'disabled') || 'full';

    const providerInfo = globalAIService.getProviderInfo();

    logger.info('Sending request to AI provider', {
      operation: 'ai_completion',
      userId,
      projectId: requirementId,
      messageCount: request.messages.length,
      correlationId,
      auditLevel
    });

    // Execute AI completion with full audit logging
    const result = await AIAuditService.executeWithAudit(
      () => globalAIService.complete(request, { userId, projectId: requirementId }),
      {
        requirement_id: requirementId,
        user_id: userId,
        provider_type: providerInfo?.type || 'unknown',
        provider_model: providerInfo?.model,
        provider_endpoint: 'configured-endpoint',
        correlation_id: correlationId,
        job_id: jobId,
        session_context: {
          user_agent: req.headers['user-agent'],
          ip: req.ip,
          session_id: (req as any).sessionID
        },
        request_payload: request,
        audit_level: auditLevel,
        retention_policy: 'standard'
      }
    );

    // Log sanitized information to ordinary logs (no sensitive content)
    const sanitizedRequest = AIAuditService.sanitizeRequestForLogging(request);
    const sanitizedResponse = AIAuditService.sanitizeForLogging(result.response);

    logger.info('AI completion successful', {
      operation: 'ai_completion',
      audit_id: result.audit_id,
      responseTokens: result.response.usage?.totalTokens || 0,
      model: result.response.model,
      correlationId
    });

    console.log('[AI_COMPLETION]', {
      correlation_id: correlationId,
      audit_id: result.audit_id,
      provider_type: providerInfo?.type,
      request_summary: sanitizedRequest,
      response_summary: sanitizedResponse
    });

    // Return response with audit ID for traceability
    res.json({
      ...result.response,
      audit_id: result.audit_id,
      correlation_id: correlationId
    });

  } catch (error) {
    logger.error('AI completion failed', {
      operation: 'ai_completion',
      error: error instanceof Error ? error.message : 'Unknown error',
      errorName: error instanceof Error ? error.name : 'UnknownError',
      correlationId: (req as any).correlationId
    });

    // Also log error without sensitive content for debugging
    console.error('[AI_ROUTE] Completion error (sanitized):', {
      error_type: error instanceof Error ? error.name : 'UnknownError',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      correlation_id: (req as any).correlationId,
      provider_type: globalAIService.getProviderInfo()?.type
    });

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