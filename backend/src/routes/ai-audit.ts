import { Router, Request, Response } from 'express';
import { requireAuth } from '../config/auth';
import { AIProviderAuditModel } from '../models/AIProviderAudit';
import { AIAuditService } from '../services/ai-audit-service';
import { RequirementModel } from '../models/Requirement';
import { AIProviderAuditQuery } from '../models/types';
import { User } from '../models/types';

const router = Router();

// All audit routes require authentication
router.use(requireAuth);

// Get audit entries with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const {
      requirement_id,
      provider_type,
      provider_model,
      correlation_id,
      job_id,
      is_successful,
      start_date,
      end_date,
      limit = '20',
      offset = '0',
      include_payloads = 'false'
    } = req.query;

    // Security: Users can only see their own audits or audits from projects they have access to
    const query: AIProviderAuditQuery = {
      user_id: user.id, // Enforce user access
      requirement_id: requirement_id as string,
      provider_type: provider_type as string,
      provider_model: provider_model as string,
      correlation_id: correlation_id as string,
      job_id: job_id as string,
      is_successful: is_successful === 'true' ? true : is_successful === 'false' ? false : undefined,
      start_date: start_date ? new Date(start_date as string) : undefined,
      end_date: end_date ? new Date(end_date as string) : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      include_payloads: include_payloads === 'true' // Default false for security
    };

    // Remove undefined values
    Object.keys(query).forEach(key => {
      if (query[key as keyof AIProviderAuditQuery] === undefined || query[key as keyof AIProviderAuditQuery] === '') {
        delete query[key as keyof AIProviderAuditQuery];
      }
    });

    const result = await AIProviderAuditModel.findWithFilters(query);

    res.json({
      audits: result.audits,
      total: result.total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      include_payloads: include_payloads === 'true'
    });
  } catch (error) {
    console.error('Error fetching AI provider audits:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch AI provider audits'
    });
  }
});

// Get audit history for a specific requirement
router.get('/requirement/:requirementId', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { requirementId } = req.params;
    const {
      include_payloads = 'false',
      limit = '50'
    } = req.query;

    // Check if user has access to this requirement
    const hasAccess = await RequirementModel.canUserAccess(requirementId, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const audits = await AIAuditService.getRequirementAuditHistory(
      requirementId,
      include_payloads === 'true',
      parseInt(limit as string)
    );

    res.json({
      audits,
      requirement_id: requirementId,
      total: audits.length,
      include_payloads: include_payloads === 'true'
    });
  } catch (error) {
    console.error('Error fetching requirement audit history:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch requirement audit history'
    });
  }
});

// Get audit trail by correlation ID
router.get('/correlation/:correlationId', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { correlationId } = req.params;
    const { include_payloads = 'false' } = req.query;

    const audits = await AIAuditService.getCorrelationAuditTrail(
      correlationId,
      include_payloads === 'true'
    );

    // Filter audits to only show those the user has access to
    const accessibleAudits = [];
    for (const audit of audits) {
      // Users can see their own audits or audits from requirements they have access to
      if (audit.user_id === user.id ||
          (audit.requirement_id && await RequirementModel.canUserAccess(audit.requirement_id, user.id))) {
        accessibleAudits.push(audit);
      }
    }

    res.json({
      audits: accessibleAudits,
      correlation_id: correlationId,
      total: accessibleAudits.length,
      include_payloads: include_payloads === 'true'
    });
  } catch (error) {
    console.error('Error fetching correlation audit trail:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch correlation audit trail'
    });
  }
});

// Get specific audit entry by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { include_payloads = 'false' } = req.query;

    // Check if user has access to this audit entry
    const hasAccess = await AIProviderAuditModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this audit entry'
      });
    }

    const audit = await AIProviderAuditModel.findById(id, include_payloads === 'true');
    if (!audit) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Audit entry not found'
      });
    }

    res.json({
      audit,
      include_payloads: include_payloads === 'true'
    });
  } catch (error) {
    console.error('Error fetching audit entry:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch audit entry'
    });
  }
});

// Get audit summaries
router.get('/summaries/overview', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const {
      requirement_id,
      provider_type,
      provider_model,
      start_date,
      end_date,
      limit = '30',
      offset = '0'
    } = req.query;

    // Security: Only show summaries for user's data or projects they have access to
    const filters: any = { user_id: user.id };

    if (requirement_id) {
      // Check access to the requirement
      const hasAccess = await RequirementModel.canUserAccess(requirement_id as string, user.id);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'You do not have access to this requirement'
        });
      }
      filters.requirement_id = requirement_id;
    }

    if (provider_type) filters.provider_type = provider_type;
    if (provider_model) filters.provider_model = provider_model;
    if (start_date) filters.start_date = new Date(start_date as string);
    if (end_date) filters.end_date = new Date(end_date as string);
    filters.limit = parseInt(limit as string);
    filters.offset = parseInt(offset as string);

    const result = await AIAuditService.getAuditSummaries(filters);

    res.json({
      summaries: result.summaries,
      total: result.total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Error fetching audit summaries:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch audit summaries'
    });
  }
});

// Get usage statistics
router.get('/stats/usage', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const {
      requirement_id,
      provider_type,
      start_date,
      end_date
    } = req.query;

    const filters: any = { user_id: user.id };

    if (requirement_id) {
      // Check access to the requirement
      const hasAccess = await RequirementModel.canUserAccess(requirement_id as string, user.id);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'You do not have access to this requirement'
        });
      }
      filters.requirement_id = requirement_id;
    }

    if (provider_type) filters.provider_type = provider_type;

    if (start_date && end_date) {
      filters.date_range = {
        start: new Date(start_date as string),
        end: new Date(end_date as string)
      };
    }

    const stats = await AIAuditService.getUsageStatistics(filters);

    res.json({
      stats,
      filters: {
        requirement_id,
        provider_type,
        user_id: user.id,
        date_range: filters.date_range
      }
    });
  } catch (error) {
    console.error('Error fetching AI usage statistics:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch AI usage statistics'
    });
  }
});

export default router;