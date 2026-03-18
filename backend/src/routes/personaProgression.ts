import { Router, Request, Response } from 'express';
import { PersonaProgressionService } from '../models/PersonaProgression';
import { ProjectModel } from '../models/Project';
import { CreatePersonaProgressionRequest, UpdatePersonaProgressionRequest } from '../models/types';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Create a new persona progression record
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const data: CreatePersonaProgressionRequest = req.body;

    // Validate required fields
    if (!data.project_id || !data.session_id) {
      return res.status(400).json({ error: 'project_id and session_id are required' });
    }

    // Check if user can access the project
    const canAccess = await ProjectModel.canUserAccess(data.project_id, req.user.id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const progression = await PersonaProgressionService.create(data, req.user.id);
    res.status(201).json(progression);
  } catch (error) {
    console.error('Failed to create persona progression:', error);
    res.status(500).json({ error: 'Failed to create persona progression record' });
  }
});

// Get progression record by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    // Check if user can access this progression record
    const canAccess = await PersonaProgressionService.canUserAccess(id, req.user.id);
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
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const data: UpdatePersonaProgressionRequest = req.body;

    // Check if user can access this progression record
    const canAccess = await PersonaProgressionService.canUserAccess(id, req.user.id);
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
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { sessionId } = req.params;
    const progressionHistory = await PersonaProgressionService.findBySessionId(sessionId);

    // Check if user can access at least one record (they all should belong to same project)
    if (progressionHistory.length > 0) {
      const canAccess = await ProjectModel.canUserAccess(progressionHistory[0].project_id, req.user.id);
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
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { projectId } = req.params;

    // Check if user can access the project
    const canAccess = await ProjectModel.canUserAccess(projectId, req.user.id);
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
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { projectId } = req.params;
    const { session_id } = req.query;

    // Check if user can access the project
    const canAccess = await ProjectModel.canUserAccess(projectId, req.user.id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const currentSession = await PersonaProgressionService.getCurrentSession(
      req.user.id,
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
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { projectId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // Check if user can access the project
    const canAccess = await ProjectModel.canUserAccess(projectId, req.user.id);
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
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { projectId } = req.params;

    // Check if user can access the project
    const canAccess = await ProjectModel.canUserAccess(projectId, req.user.id);
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
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { projectId } = req.params;

    // Check if user can access the project
    const canAccess = await ProjectModel.canUserAccess(projectId, req.user.id);
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
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

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
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { sessionId } = req.params;

    // First check if user has access to this session
    const sessionData = await PersonaProgressionService.findBySessionId(sessionId);
    if (sessionData.length > 0) {
      const canAccess = await ProjectModel.canUserAccess(sessionData[0].project_id, req.user.id);
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
  }
});

export default router;