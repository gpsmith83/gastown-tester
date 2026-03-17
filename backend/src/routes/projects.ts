import { Router, Request, Response } from 'express';
import { requireAuth } from '../config/auth';
import { ProjectModel } from '../models/Project';
import { WorkspaceModel } from '../models/Workspace';
import { RequirementModel } from '../models/Requirement';
import { ReadinessAnalyzerService } from '../services/readiness-analyzer';
import { ReadinessGateService } from '../services/readiness-gate';
import { CreateProjectRequest } from '../models/types';
import { User } from '../models/types';

const router = Router();

// All project routes require authentication
router.use(requireAuth);

// Get user's projects (across all workspaces they have access to)
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const projects = await ProjectModel.findByUserIdWithLinearConnection(user.id);

    res.json({
      projects,
      total: projects.length
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch projects'
    });
  }
});

// Get projects in a specific workspace
router.get('/workspace/:workspaceId', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { workspaceId } = req.params;

    // Check if user has access to this workspace
    const membership = await WorkspaceModel.isUserMember(workspaceId, user.id);
    if (!membership) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this workspace'
      });
    }

    const projects = await ProjectModel.findByWorkspaceId(workspaceId);

    res.json({
      projects,
      workspace_id: workspaceId,
      total: projects.length
    });
  } catch (error) {
    console.error('Error fetching workspace projects:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch workspace projects'
    });
  }
});

// Create new project
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const data: CreateProjectRequest = req.body;

    // Basic validation
    if (!data.name || data.name.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Project name is required'
      });
    }

    if (!data.workspace_id) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Workspace ID is required'
      });
    }

    if (data.name.length > 255) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Project name must be 255 characters or less'
      });
    }

    // Check if user has access to the workspace
    const membership = await WorkspaceModel.isUserMember(data.workspace_id, user.id);
    if (!membership) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this workspace'
      });
    }

    // Clean up data
    const cleanData: CreateProjectRequest = {
      name: data.name.trim(),
      description: data.description?.trim(),
      workspace_id: data.workspace_id,
      product_area: data.product_area?.trim(),
      goals: Array.isArray(data.goals) ? data.goals.filter(g => g && g.trim()).map(g => g.trim()) : [],
      default_labels: Array.isArray(data.default_labels) ? data.default_labels : [],
      default_persona_stack: data.default_persona_stack || null
    };

    const project = await ProjectModel.create(cleanData, user.id);

    // Return project with full details
    const projectWithDetails = await ProjectModel.findByIdWithDetails(project.id);

    res.status(201).json({
      project: projectWithDetails,
      message: 'Project created successfully'
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create project'
    });
  }
});

// Get specific project
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user has access to this project
    const hasAccess = await ProjectModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    const project = await ProjectModel.findByIdWithLinearConnection(id);
    if (!project) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    res.json({
      project
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch project'
    });
  }
});

// Update project
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const data: Partial<CreateProjectRequest> = req.body;

    // Check if user has access to this project
    const hasAccess = await ProjectModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    // For now, allow all workspace members to edit projects
    // In the future, you might want to restrict to owners/admins

    // Basic validation
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Project name is required'
        });
      }

      if (data.name.length > 255) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Project name must be 255 characters or less'
        });
      }

      data.name = data.name.trim();
    }

    // Clean up other fields
    if (data.description !== undefined) {
      data.description = data.description?.trim();
    }

    if (data.product_area !== undefined) {
      data.product_area = data.product_area?.trim();
    }

    if (data.goals !== undefined) {
      data.goals = Array.isArray(data.goals) ? data.goals.filter(g => g && g.trim()).map(g => g.trim()) : [];
    }

    if (data.default_labels !== undefined) {
      data.default_labels = Array.isArray(data.default_labels) ? data.default_labels : [];
    }

    const project = await ProjectModel.update(id, data);
    if (!project) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    // Return updated project with full details
    const projectWithDetails = await ProjectModel.findByIdWithDetails(project.id);

    res.json({
      project: projectWithDetails,
      message: 'Project updated successfully'
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update project'
    });
  }
});

// Update project status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'archived', 'draft'].includes(status)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid status. Must be active, archived, or draft'
      });
    }

    // Check if user owns this project
    const isOwner = await ProjectModel.isUserOwner(id, user.id);
    if (!isOwner) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'Only project owners can change project status'
      });
    }

    const project = await ProjectModel.updateStatus(id, status);
    if (!project) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    res.json({
      project,
      message: `Project ${status === 'archived' ? 'archived' : 'status updated'} successfully`
    });
  } catch (error) {
    console.error('Error updating project status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update project status'
    });
  }
});

// Delete project (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user owns this project
    const isOwner = await ProjectModel.isUserOwner(id, user.id);
    if (!isOwner) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'Only project owners can delete projects'
      });
    }

    const deleted = await ProjectModel.delete(id);
    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    res.json({
      message: 'Project archived successfully'
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete project'
    });
  }
});

// Get readiness statistics for a project (B-205)
router.get('/:id/readiness/stats', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user has access to this project
    const hasAccess = await ProjectModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    const stats = await ReadinessAnalyzerService.getProjectReadinessStats(id);

    res.json({
      project_id: id,
      readiness_stats: stats
    });
  } catch (error) {
    console.error('Error fetching project readiness stats:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch project readiness statistics'
    });
  }
});

// Analyze readiness for all requirements in a project (B-205)
router.post('/:id/readiness/analyze', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { force_recompute } = req.body;

    // Check if user has access to this project
    const hasAccess = await ProjectModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    const readinessIds = await ReadinessAnalyzerService.analyzeProjectReadiness(id, {
      userId: user.id,
      projectId: id,
      forceRecompute: force_recompute
    });

    // Get updated stats after analysis
    const stats = await ReadinessAnalyzerService.getProjectReadinessStats(id);

    res.status(201).json({
      project_id: id,
      analyzed_count: readinessIds.length,
      readiness_stats: stats,
      message: `Analyzed readiness for ${readinessIds.length} requirements`
    });
  } catch (error) {
    console.error('Error analyzing project readiness:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to analyze project readiness'
    });
  }
});

// Check readiness gates for all requirements in a project (B-305)
router.get('/:id/gate/check', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { include_override_details } = req.query;

    // Check if user has access to this project
    const hasAccess = await ProjectModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    // Get all requirements for the project
    const requirements = await RequirementModel.findByProjectId(id);
    const requirementIds = requirements.map(req => req.id);

    if (requirementIds.length === 0) {
      return res.json({
        project_id: id,
        gate_results: [],
        summary: {
          total_requirements: 0,
          passed_gate: 0,
          failed_gate: 0,
          with_overrides: 0
        }
      });
    }

    // Check gates for all requirements
    const gateResults = await ReadinessGateService.checkMultipleRequirements(requirementIds, {
      includeOverrideDetails: include_override_details === 'true'
    });

    // Calculate summary statistics
    const summary = {
      total_requirements: gateResults.length,
      passed_gate: gateResults.filter(r => r.gate_passed).length,
      failed_gate: gateResults.filter(r => !r.gate_passed).length,
      with_overrides: gateResults.filter(r => r.has_active_override).length
    };

    res.json({
      project_id: id,
      gate_results: gateResults,
      summary
    });
  } catch (error) {
    console.error('Error checking project readiness gates:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to check project readiness gates'
    });
  }
});

// Get gate rules and configuration (B-305)
router.get('/:id/gate/rules', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user has access to this project
    const hasAccess = await ProjectModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    const gateRules = ReadinessGateService.getDefaultGateRules();

    res.json({
      project_id: id,
      gate_rules: gateRules,
      description: {
        purpose: 'These rules determine when a requirement is ready for ticket generation',
        blocking_dimensions: [
          'clarity: Requirement must be well-defined and unambiguous',
          'completeness: All necessary details must be specified',
          'testability: Must have clear, measurable acceptance criteria',
          'feasibility: Must be technically achievable and realistic',
          'specificity: Must be specific enough to guide implementation'
        ],
        override_options: [
          'manual_approval: Explicit approval despite failing gate',
          'emergency_bypass: Urgent work that bypasses normal gates',
          'stakeholder_decision: Business decision to proceed despite risks'
        ]
      }
    });
  } catch (error) {
    console.error('Error fetching gate rules:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch gate rules'
    });
  }
});

export default router;