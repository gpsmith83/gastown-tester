import { Router, Request, Response } from 'express';
import { requireAuth } from '../config/auth';
import { RequirementModel } from '../models/Requirement';
import { ProjectModel } from '../models/Project';
import { RefinementSummaryModel } from '../models/RefinementSummary';
import { RequirementReadinessModel } from '../models/RequirementReadiness';
import { ReadinessGateOverrideModel } from '../models/ReadinessGateOverride';
import { ReadinessAnalyzerService } from '../services/readiness-analyzer';
import { ReadinessGateService } from '../services/readiness-gate';
import { CreateRequirementRequest } from '../models/types';
import { User } from '../models/types';

const router = Router();

// All requirement routes require authentication
router.use(requireAuth);

// Get user's requirements (across all projects they have access to)
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const requirements = await RequirementModel.findByUserId(user.id);

    res.json({
      requirements,
      total: requirements.length
    });
  } catch (error) {
    console.error('Error fetching requirements:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch requirements'
    });
  }
});

// Get requirements in a specific project
router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { projectId } = req.params;

    // Check if user has access to this project
    const hasAccess = await ProjectModel.canUserAccess(projectId, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    const requirements = await RequirementModel.findByProjectId(projectId);

    res.json({
      requirements,
      project_id: projectId,
      total: requirements.length
    });
  } catch (error) {
    console.error('Error fetching project requirements:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch project requirements'
    });
  }
});

// Create new requirement
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const data: CreateRequirementRequest = req.body;

    // Basic validation
    if (!data.title || data.title.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Requirement title is required'
      });
    }

    if (!data.project_id) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Project ID is required'
      });
    }

    if (data.title.length > 500) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Requirement title must be 500 characters or less'
      });
    }

    // Validate priority
    if (data.priority !== undefined && (data.priority < 1 || data.priority > 5)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Priority must be between 1 (highest) and 5 (lowest)'
      });
    }

    // Validate type
    if (data.type && !['feature', 'bug', 'enhancement', 'epic'].includes(data.type)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Type must be one of: feature, bug, enhancement, epic'
      });
    }

    // Check if user has access to the project
    const hasAccess = await ProjectModel.canUserAccess(data.project_id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    // Clean up data
    const cleanData: CreateRequirementRequest = {
      title: data.title.trim(),
      description: data.description?.trim(),
      project_id: data.project_id,
      priority: data.priority || 3,
      type: data.type || 'feature',
      github_issue_number: data.github_issue_number,
      github_issue_url: data.github_issue_url?.trim()
    };

    const requirement = await RequirementModel.create(cleanData, user.id);

    // Return requirement with full details
    const requirementWithDetails = await RequirementModel.findByIdWithDetails(requirement.id);

    res.status(201).json({
      requirement: requirementWithDetails,
      message: 'Requirement created successfully'
    });
  } catch (error) {
    console.error('Error creating requirement:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create requirement'
    });
  }
});

// Get specific requirement
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user has access to this requirement
    const hasAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const requirement = await RequirementModel.findByIdWithDetails(id);
    if (!requirement) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Requirement not found'
      });
    }

    res.json({
      requirement
    });
  } catch (error) {
    console.error('Error fetching requirement:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch requirement'
    });
  }
});

// Update requirement
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const data: Partial<CreateRequirementRequest> = req.body;

    // Check if user has access to this requirement
    const hasAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    // For now, allow all project members to edit requirements
    // In the future, you might want to restrict to authors/admins

    // Basic validation
    if (data.title !== undefined) {
      if (!data.title || data.title.trim().length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Requirement title is required'
        });
      }

      if (data.title.length > 500) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Requirement title must be 500 characters or less'
        });
      }

      data.title = data.title.trim();
    }

    // Validate priority
    if (data.priority !== undefined && (data.priority < 1 || data.priority > 5)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Priority must be between 1 (highest) and 5 (lowest)'
      });
    }

    // Validate type
    if (data.type && !['feature', 'bug', 'enhancement', 'epic'].includes(data.type)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Type must be one of: feature, bug, enhancement, epic'
      });
    }

    // Clean up other fields
    if (data.description !== undefined) {
      data.description = data.description?.trim();
    }

    if (data.github_issue_url !== undefined) {
      data.github_issue_url = data.github_issue_url?.trim();
    }

    const requirement = await RequirementModel.update(id, data);
    if (!requirement) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Requirement not found'
      });
    }

    // Return updated requirement with full details
    const requirementWithDetails = await RequirementModel.findByIdWithDetails(requirement.id);

    res.json({
      requirement: requirementWithDetails,
      message: 'Requirement updated successfully'
    });
  } catch (error) {
    console.error('Error updating requirement:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update requirement'
    });
  }
});

// Update requirement status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { status } = req.body;

    if (!['draft', 'active', 'completed', 'archived'].includes(status)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid status. Must be draft, active, completed, or archived'
      });
    }

    // Check if user has access to this requirement
    const hasAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    // For now, allow all project members to change status
    // In the future, you might want to restrict to authors/admins

    const requirement = await RequirementModel.updateStatus(id, status);
    if (!requirement) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Requirement not found'
      });
    }

    res.json({
      requirement,
      message: `Requirement status updated to ${status} successfully`
    });
  } catch (error) {
    console.error('Error updating requirement status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update requirement status'
    });
  }
});

// Delete requirement (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user is the author of this requirement
    const isAuthor = await RequirementModel.isUserAuthor(id, user.id);
    if (!isAuthor) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'Only requirement authors can delete requirements'
      });
    }

    const deleted = await RequirementModel.delete(id);
    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Requirement not found'
      });
    }

    res.json({
      message: 'Requirement deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting requirement:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete requirement'
    });
  }
});

// Get summaries for a requirement (across all refinement sessions)
router.get('/:id/summaries', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user has access to this requirement
    const hasAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const summaries = await RefinementSummaryModel.findByRequirementId(id);

    res.json({
      summaries,
      total: summaries.length
    });
  } catch (error) {
    console.error('Error fetching requirement summaries:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch requirement summaries'
    });
  }
});

// Get latest summary for a requirement
router.get('/:id/summary/latest', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user has access to this requirement
    const hasAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const summary = await RefinementSummaryModel.findLatestByRequirementId(id);

    if (!summary) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No summary found for this requirement'
      });
    }

    res.json({
      summary
    });
  } catch (error) {
    console.error('Error fetching latest requirement summary:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch latest requirement summary'
    });
  }
});

// Get readiness for a requirement (B-205)
router.get('/:id/readiness', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user has access to this requirement
    const hasAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const readiness = await RequirementReadinessModel.findByRequirementIdWithDetails(id);

    if (!readiness) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No readiness analysis found for this requirement'
      });
    }

    res.json({
      readiness
    });
  } catch (error) {
    console.error('Error fetching requirement readiness:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch requirement readiness'
    });
  }
});

// Analyze/compute readiness for a requirement (B-205)
router.post('/:id/readiness/analyze', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { force_recompute } = req.body;

    // Check if user has access to this requirement
    const hasAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    // Get requirement to get project_id
    const requirement = await RequirementModel.findByIdWithDetails(id);
    if (!requirement) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Requirement not found'
      });
    }

    const readinessId = await ReadinessAnalyzerService.analyzeRequirementReadiness(id, {
      userId: user.id,
      projectId: requirement.project_id,
      forceRecompute: force_recompute
    });

    if (!readinessId) {
      return res.status(400).json({
        error: 'Analysis Failed',
        message: 'Unable to compute readiness (requirement may already be analyzed)'
      });
    }

    const readiness = await RequirementReadinessModel.findByRequirementIdWithDetails(id);

    res.status(201).json({
      readiness,
      message: 'Readiness analysis completed successfully'
    });
  } catch (error) {
    console.error('Error analyzing requirement readiness:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to analyze requirement readiness'
    });
  }
});

// Check readiness gate for a requirement (B-305)
router.get('/:id/gate', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { include_override_details } = req.query;

    // Check if user has access to this requirement
    const hasAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const gateResult = await ReadinessGateService.checkReadinessGate(id, {
      includeOverrideDetails: include_override_details === 'true'
    });

    res.json({
      gate_result: gateResult
    });
  } catch (error) {
    console.error('Error checking readiness gate:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to check readiness gate'
    });
  }
});

// Create readiness gate override (B-305)
router.post('/:id/gate/override', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { override_type, override_reason, valid_until, conditions } = req.body;

    // Validation
    if (!override_reason || override_reason.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Override reason is required'
      });
    }

    if (!override_type || !['manual_approval', 'emergency_bypass', 'stakeholder_decision'].includes(override_type)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid override_type. Must be manual_approval, emergency_bypass, or stakeholder_decision'
      });
    }

    // Check if user has access to this requirement
    const hasAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const overrideData = {
      requirement_id: id,
      override_type,
      override_reason: override_reason.trim(),
      valid_until: valid_until ? new Date(valid_until) : undefined,
      conditions: conditions?.trim()
    };

    const overrideId = await ReadinessGateService.createOverride(overrideData, user.id);
    const override = await ReadinessGateOverrideModel.findByIdWithDetails(overrideId);

    res.status(201).json({
      override,
      message: 'Readiness gate override created successfully'
    });
  } catch (error) {
    console.error('Error creating readiness gate override:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create readiness gate override'
    });
  }
});

// Get overrides for a requirement (B-305)
router.get('/:id/gate/overrides', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user has access to this requirement
    const hasAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    const overrides = await ReadinessGateService.getRequirementOverrides(id);

    res.json({
      overrides,
      total: overrides.length
    });
  } catch (error) {
    console.error('Error fetching requirement overrides:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch requirement overrides'
    });
  }
});

// Revoke readiness gate override (B-305)
router.delete('/:id/gate/override/:overrideId', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id, overrideId } = req.params;

    // Check if user has access to this requirement
    const hasAccess = await RequirementModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this requirement'
      });
    }

    // Check if user has access to this override
    const canAccessOverride = await ReadinessGateOverrideModel.canUserAccess(overrideId, user.id);
    if (!canAccessOverride) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this override'
      });
    }

    const revoked = await ReadinessGateService.revokeOverride(overrideId, user.id);
    if (!revoked) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Override not found or already revoked'
      });
    }

    res.json({
      message: 'Readiness gate override revoked successfully'
    });
  } catch (error) {
    console.error('Error revoking readiness gate override:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to revoke readiness gate override'
    });
  }
});

export default router;