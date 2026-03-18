import { Router, Request, Response } from 'express';
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
  }
});

export default router;