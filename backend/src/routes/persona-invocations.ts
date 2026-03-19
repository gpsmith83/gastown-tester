import { Router, Request, Response } from 'express';
import { requireAuth } from '../config/auth';
import { PersonaInvocationModel } from '../models/PersonaInvocation';
import { RefinementSessionModel } from '../models/RefinementSession';
import { RequirementModel } from '../models/Requirement';
import { CreatePersonaInvocationRequest } from '../models/types';
import { User } from '../models/types';

const router = Router();

// All persona invocation routes require authentication
router.use(requireAuth);

// Get user's persona invocations (across all projects they have access to)
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const {
      requirement_id,
      session_id,
      persona_type,
      invocation_status,
      limit = '10',
      offset = '0'
    } = req.query;

    const filters = {
      user_id: user.id,
      requirement_id: requirement_id as string,
      session_id: session_id as string,
      persona_type: persona_type as string,
      invocation_status: invocation_status as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined || filters[key] === '') {
        delete filters[key];
      }
    });

    const result = await PersonaInvocationModel.findWithFilters(filters);

    res.json({
      invocations: result.invocations,
      total: result.total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Error fetching persona invocations:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch persona invocations'
    });
  }
});

// Get persona invocations for a specific requirement
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

    const invocations = await PersonaInvocationModel.findByRequirementId(requirementId);

    res.json({
      invocations,
      requirement_id: requirementId,
      total: invocations.length
    });
  } catch (error) {
    console.error('Error fetching requirement persona invocations:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch requirement persona invocations'
    });
  }
});

// Get persona invocations for a specific session
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { sessionId } = req.params;

    // Check if user has access to this session
    const hasAccess = await RefinementSessionModel.canUserAccess(sessionId, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this refinement session'
      });
    }

    const invocations = await PersonaInvocationModel.findBySessionId(sessionId);

    res.json({
      invocations,
      session_id: sessionId,
      total: invocations.length
    });
  } catch (error) {
    console.error('Error fetching session persona invocations:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch session persona invocations'
    });
  }
});

// Create new persona invocation
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const data: CreatePersonaInvocationRequest = req.body;

    // Basic validation
    if (!data.requirement_id || !data.session_id || !data.persona_name || !data.invocation_reason) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'requirement_id, session_id, persona_name, and invocation_reason are required'
      });
    }

    if (!Array.isArray(data.contributed_dimensions)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'contributed_dimensions must be an array'
      });
    }

    // Check if user has access to the requirement
    const hasRequirementAccess = await RequirementModel.canUserAccess(data.requirement_id, user.id);
    if (!hasRequirementAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    // Check if user has access to the session
    const hasSessionAccess = await RefinementSessionModel.canUserAccess(data.session_id, user.id);
    if (!hasSessionAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this refinement session'
      });
    }

    // Validate contributed dimensions
    for (const dimension of data.contributed_dimensions) {
      if (!dimension.category || !dimension.name || !dimension.value) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Each dimension must have category, name, and value'
        });
      }
    }

    // Clean up data
    const cleanData: CreatePersonaInvocationRequest = {
      requirement_id: data.requirement_id,
      session_id: data.session_id,
      persona_name: data.persona_name.trim(),
      persona_type: data.persona_type?.trim(),
      persona_description: data.persona_description?.trim(),
      invocation_reason: data.invocation_reason.trim(),
      trigger_context: data.trigger_context,
      contributed_dimensions: data.contributed_dimensions.map(dim => ({
        category: dim.category.trim(),
        name: dim.name.trim(),
        value: dim.value.trim(),
        confidence_score: dim.confidence_score,
        contribution_type: dim.contribution_type,
        impact_level: dim.impact_level,
        rationale: dim.rationale?.trim()
      })),
      dimension_summary: data.dimension_summary?.trim(),
      invocation_metadata: data.invocation_metadata || {}
    };

    const invocation = await PersonaInvocationModel.create(cleanData, user.id);

    // Mark as completed immediately for now (in future, this could be async)
    await PersonaInvocationModel.markCompleted(invocation.id);

    // Return invocation with full details
    const invocationWithDetails = await PersonaInvocationModel.findByIdWithDetails(invocation.id);

    res.status(201).json({
      invocation: invocationWithDetails,
      message: 'Persona invocation created successfully'
    });
  } catch (error) {
    console.error('Error creating persona invocation:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create persona invocation'
    });
  }
});

// Get specific persona invocation
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user has access to this persona invocation
    const hasAccess = await PersonaInvocationModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this persona invocation'
      });
    }

    const invocation = await PersonaInvocationModel.findByIdWithDetails(id);
    if (!invocation) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Persona invocation not found'
      });
    }

    res.json({
      invocation
    });
  } catch (error) {
    console.error('Error fetching persona invocation:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch persona invocation'
    });
  }
});

// Update persona invocation
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const data: Partial<CreatePersonaInvocationRequest> = req.body;

    // Check if user has access to this persona invocation
    const hasAccess = await PersonaInvocationModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this persona invocation'
      });
    }

    // Validate contributed dimensions if provided
    if (data.contributed_dimensions) {
      if (!Array.isArray(data.contributed_dimensions)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'contributed_dimensions must be an array'
        });
      }

      for (const dimension of data.contributed_dimensions) {
        if (!dimension.category || !dimension.name || !dimension.value) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Each dimension must have category, name, and value'
          });
        }
      }
    }

    // Clean up data
    if (data.persona_name) data.persona_name = data.persona_name.trim();
    if (data.persona_type) data.persona_type = data.persona_type.trim();
    if (data.persona_description) data.persona_description = data.persona_description.trim();
    if (data.invocation_reason) data.invocation_reason = data.invocation_reason.trim();
    if (data.dimension_summary) data.dimension_summary = data.dimension_summary.trim();

    const invocation = await PersonaInvocationModel.update(id, data);
    if (!invocation) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Persona invocation not found'
      });
    }

    // Return updated invocation with full details
    const invocationWithDetails = await PersonaInvocationModel.findByIdWithDetails(invocation.id);

    res.json({
      invocation: invocationWithDetails,
      message: 'Persona invocation updated successfully'
    });
  } catch (error) {
    console.error('Error updating persona invocation:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update persona invocation'
    });
  }
});

// Update persona invocation status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid status. Must be pending, completed, or failed'
      });
    }

    // Check if user has access to this persona invocation
    const hasAccess = await PersonaInvocationModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this persona invocation'
      });
    }

    const invocation = await PersonaInvocationModel.updateStatus(id, status);
    if (!invocation) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Persona invocation not found'
      });
    }

    res.json({
      invocation,
      message: `Persona invocation status updated to ${status} successfully`
    });
  } catch (error) {
    console.error('Error updating persona invocation status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update persona invocation status'
    });
  }
});

// Get persona invocation statistics
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const {
      requirement_id,
      session_id,
      start_date,
      end_date
    } = req.query;

    const filters: any = { user_id: user.id };

    if (requirement_id) filters.requirement_id = requirement_id as string;
    if (session_id) filters.session_id = session_id as string;

    if (start_date && end_date) {
      filters.date_range = {
        start: new Date(start_date as string),
        end: new Date(end_date as string)
      };
    }

    const stats = await PersonaInvocationModel.getInvocationStats(filters);

    res.json({
      stats,
      filters: {
        requirement_id,
        session_id,
        user_id: user.id,
        date_range: filters.date_range
      }
    });
  } catch (error) {
    console.error('Error fetching persona invocation statistics:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch persona invocation statistics'
    });
  }
});

export default router;