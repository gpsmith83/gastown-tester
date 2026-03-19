import { Router, Request, Response } from 'express';
<<<<<<< HEAD
import { PersonaProgressionService } from '../models/PersonaProgression';
import { ProjectModel } from '../models/Project';
import { CreatePersonaProgressionRequest, UpdatePersonaProgressionRequest, User } from '../models/types';
import { requireAuth } from '../config/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

// Create a new persona progression record
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const data: CreatePersonaProgressionRequest = req.body;

    // Validate required fields
    if (!data.project_id || !data.session_id) {
      return res.status(400).json({ error: 'project_id and session_id are required' });
    }

    // Check if user can access the project
    const canAccess = await ProjectModel.canUserAccess(data.project_id, user.id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const progression = await PersonaProgressionService.create(data, user.id);
    res.status(201).json(progression);
  } catch (error) {
    console.error('Failed to create persona progression:', error);
    res.status(500).json({ error: 'Failed to create persona progression record' });
  }
});

// Get progression record by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user can access this progression record
    const canAccess = await PersonaProgressionService.canUserAccess(id, user.id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied to this progression record' });
    }

    const progression = await PersonaProgressionService.findById(id);
    if (!progression) {
      return res.status(404).json({ error: 'Progression record not found' });
    }

    res.json(progression);
  } catch (error) {
    console.error('Failed to get progression record:', error);
    res.status(500).json({ error: 'Failed to retrieve progression record' });
  }
});

// Update progression record
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const data: UpdatePersonaProgressionRequest = req.body;

    // Check if user can access this progression record
    const canAccess = await PersonaProgressionService.canUserAccess(id, user.id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied to this progression record' });
    }

    const updatedProgression = await PersonaProgressionService.update(id, data);
    if (!updatedProgression) {
      return res.status(404).json({ error: 'Progression record not found' });
    }

    res.json(updatedProgression);
  } catch (error) {
    console.error('Failed to update progression record:', error);
    res.status(500).json({ error: 'Failed to update progression record' });
  }
});

// Get progression history for a specific session
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { sessionId } = req.params;
    const progressionHistory = await PersonaProgressionService.findBySessionId(sessionId);

    // Check if user can access at least one record (they all should belong to same project)
    if (progressionHistory.length > 0) {
      const canAccess = await ProjectModel.canUserAccess(progressionHistory[0].project_id, user.id);
      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied to this session' });
      }
    }

    res.json(progressionHistory);
  } catch (error) {
    console.error('Failed to get session progression:', error);
    res.status(500).json({ error: 'Failed to retrieve session progression' });
  }
});

// Get progression history for a project
router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { projectId } = req.params;

    // Check if user can access the project
    const canAccess = await ProjectModel.canUserAccess(projectId, user.id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const progressionHistory = await PersonaProgressionService.findByProjectId(projectId);
    res.json(progressionHistory);
  } catch (error) {
    console.error('Failed to get project progression:', error);
    res.status(500).json({ error: 'Failed to retrieve project progression history' });
  }
});

// Get current session state for user in project
router.get('/project/:projectId/current-session', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { projectId } = req.params;
    const { session_id } = req.query;

    // Check if user can access the project
    const canAccess = await ProjectModel.canUserAccess(projectId, user.id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const currentSession = await PersonaProgressionService.getCurrentSession(
      user.id,
      projectId,
      session_id as string | undefined
    );

    if (!currentSession) {
      return res.status(404).json({ error: 'No active session found' });
    }

    res.json(currentSession);
  } catch (error) {
    console.error('Failed to get current session:', error);
    res.status(500).json({ error: 'Failed to retrieve current session' });
  }
});

// Get specialist usage history for a project
router.get('/project/:projectId/specialists', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { projectId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // Check if user can access the project
    const canAccess = await ProjectModel.canUserAccess(projectId, user.id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const specialistHistory = await PersonaProgressionService.getSpecialistHistory(projectId, limit);
    res.json(specialistHistory);
  } catch (error) {
    console.error('Failed to get specialist history:', error);
    res.status(500).json({ error: 'Failed to retrieve specialist history' });
  }
});

// Get stage analytics for a project
router.get('/project/:projectId/stages', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { projectId } = req.params;

    // Check if user can access the project
    const canAccess = await ProjectModel.canUserAccess(projectId, user.id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const stageAnalytics = await PersonaProgressionService.getStageAnalytics(projectId);
    res.json(stageAnalytics);
  } catch (error) {
    console.error('Failed to get stage analytics:', error);
    res.status(500).json({ error: 'Failed to retrieve stage analytics' });
  }
});

// Get comprehensive analytics for a project
router.get('/project/:projectId/analytics', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { projectId } = req.params;

    // Check if user can access the project
    const canAccess = await ProjectModel.canUserAccess(projectId, user.id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const analytics = await PersonaProgressionService.getProjectAnalytics(projectId);
    res.json(analytics);
  } catch (error) {
    console.error('Failed to get project analytics:', error);
    res.status(500).json({ error: 'Failed to retrieve project analytics' });
  }
});

// Generate a new session ID
router.post('/generate-session', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const sessionId = PersonaProgressionService.generateSessionId();
    res.json({ session_id: sessionId });
  } catch (error) {
    console.error('Failed to generate session ID:', error);
    res.status(500).json({ error: 'Failed to generate session ID' });
  }
});

// Delete progression records for a session (cleanup)
router.delete('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { sessionId } = req.params;

    // First check if user has access to this session
    const sessionData = await PersonaProgressionService.findBySessionId(sessionId);
    if (sessionData.length > 0) {
      const canAccess = await ProjectModel.canUserAccess(sessionData[0].project_id, user.id);
      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied to this session' });
      }
    }

    const deleted = await PersonaProgressionService.deleteBySessionId(sessionId);
    if (!deleted) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ message: 'Session progression records deleted successfully' });
  } catch (error) {
    console.error('Failed to delete session:', error);
    res.status(500).json({ error: 'Failed to delete session progression records' });
=======
import { requireAuth } from '../config/auth';
import { RequirementModel } from '../models/Requirement';
import { ReadinessGateOverrideModel, PersonaProgressionGateModel } from '../models/ReadinessGateOverride';
import {
  CreateReadinessGateOverrideRequest,
  UpdateReadinessGateOverrideRequest,
  CreatePersonaProgressionGateRequest,
  UpdatePersonaProgressionGateRequest,
  User
} from '../models/types';

const router = Router();

// All persona progression routes require authentication
router.use(requireAuth);

// B-306: Readiness Gate Override Routes

// Get all overrides for a requirement
router.get('/readiness-overrides/requirement/:requirementId', async (req: Request, res: Response) => {
  try {
    const { requirementId } = req.params;
    const user = req.user as User;

    // Check if user can access this requirement
    const canAccess = await RequirementModel.canUserAccess(requirementId, user.id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied to this requirement' });
    }

    const overrides = await ReadinessGateOverrideModel.findByRequirementId(requirementId);
    res.json({ overrides });
  } catch (error) {
    console.error('Error fetching readiness gate overrides:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific override for requirement and dimension
router.get('/readiness-overrides/requirement/:requirementId/dimension/:dimensionId', async (req: Request, res: Response) => {
  try {
    const { requirementId, dimensionId } = req.params;
    const user = req.user as User;

    // Check if user can access this requirement
    const canAccess = await RequirementModel.canUserAccess(requirementId, user.id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied to this requirement' });
    }

    const override = await ReadinessGateOverrideModel.findByRequirementAndDimension(requirementId, dimensionId);
    res.json({ override });
  } catch (error) {
    console.error('Error fetching readiness gate override:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new readiness gate override
router.post('/readiness-overrides', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;

    const data: CreateReadinessGateOverrideRequest = req.body;

    // Validate required fields
    if (!data.requirement_id || !data.dimension_id || !data.dimension_name || !data.override_reason) {
      return res.status(400).json({ error: 'Missing required fields: requirement_id, dimension_id, dimension_name, override_reason' });
    }

    // Check if user can access this requirement
    const canAccess = await RequirementModel.canUserAccess(data.requirement_id, user.id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied to this requirement' });
    }

    // Check if override already exists for this dimension
    const existingOverride = await ReadinessGateOverrideModel.findByRequirementAndDimension(
      data.requirement_id,
      data.dimension_id
    );

    if (existingOverride) {
      return res.status(409).json({
        error: 'Override already exists for this dimension',
        existing_override: existingOverride
      });
    }

    const override = await ReadinessGateOverrideModel.create(data, user.id);
    const overrideWithUser = await ReadinessGateOverrideModel.findByIdWithUser(override.id);

    res.status(201).json({
      override: overrideWithUser,
      message: 'Readiness gate override created successfully'
    });
  } catch (error) {
    console.error('Error creating readiness gate override:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a readiness gate override
router.put('/readiness-overrides/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as User;

    // Check if user can access this override
    const canAccess = await ReadinessGateOverrideModel.canUserAccess(id, user.id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied to this override' });
    }

    const data: UpdateReadinessGateOverrideRequest = req.body;
    const override = await ReadinessGateOverrideModel.update(id, data);

    if (!override) {
      return res.status(404).json({ error: 'Override not found' });
    }

    const overrideWithUser = await ReadinessGateOverrideModel.findByIdWithUser(override.id);
    res.json({
      override: overrideWithUser,
      message: 'Override updated successfully'
    });
  } catch (error) {
    console.error('Error updating readiness gate override:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a readiness gate override
router.delete('/readiness-overrides/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as User;

    // Check if user can access this override
    const canAccess = await ReadinessGateOverrideModel.canUserAccess(id, user.id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied to this override' });
    }

    const success = await ReadinessGateOverrideModel.delete(id);
    if (!success) {
      return res.status(404).json({ error: 'Override not found' });
    }

    res.json({ message: 'Override deleted successfully' });
  } catch (error) {
    console.error('Error deleting readiness gate override:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// B-307: Persona Progression Gate Routes

// Get all gates for a project
router.get('/progression-gates/project/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const user = req.user as User;

    // TODO: Add project access check once ProjectModel is available
    // For now, assuming user has access if they can authenticate

    const gates = await PersonaProgressionGateModel.findByProjectId(projectId);
    res.json({ gates });
  } catch (error) {
    console.error('Error fetching persona progression gates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get gates by persona type for a project
router.get('/progression-gates/project/:projectId/persona/:personaType', async (req: Request, res: Response) => {
  try {
    const { projectId, personaType } = req.params;
    const user = req.user as User;

    const gates = await PersonaProgressionGateModel.findByPersonaType(projectId, personaType);
    res.json({ gates });
  } catch (error) {
    console.error('Error fetching persona progression gates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new persona progression gate
router.post('/progression-gates', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;

    const data: CreatePersonaProgressionGateRequest = req.body;

    // Validate required fields
    if (!data.project_id || !data.gate_name) {
      return res.status(400).json({ error: 'Missing required fields: project_id, gate_name' });
    }

    const gate = await PersonaProgressionGateModel.create(data);
    res.status(201).json({
      gate,
      message: 'Persona progression gate created successfully'
    });
  } catch (error) {
    console.error('Error creating persona progression gate:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a persona progression gate
router.put('/progression-gates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as User;

    const data: UpdatePersonaProgressionGateRequest = req.body;
    const gate = await PersonaProgressionGateModel.update(id, data);

    if (!gate) {
      return res.status(404).json({ error: 'Gate not found' });
    }

    res.json({
      gate,
      message: 'Gate updated successfully'
    });
  } catch (error) {
    console.error('Error updating persona progression gate:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a persona progression gate
router.delete('/progression-gates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as User;

    const success = await PersonaProgressionGateModel.delete(id);
    if (!success) {
      return res.status(404).json({ error: 'Gate not found' });
    }

    res.json({ message: 'Gate deleted successfully' });
  } catch (error) {
    console.error('Error deleting persona progression gate:', error);
    res.status(500).json({ error: 'Internal server error' });
>>>>>>> check-chrome-x39
  }
});

export default router;