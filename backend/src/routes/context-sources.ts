import { Router, Request, Response } from 'express';
import { requireAuth } from '../config/auth';
import { ProjectModel } from '../models/Project';
import { ContextSourceService } from '../services/ContextSourceService';
import { IngestionJobService } from '../services/IngestionJobService';
import {
  User,
  AnalyzeProjectContextRequest,
  UpdateContextSelectionRequest
} from '../models/types';

const router = Router();

// All context source routes require authentication
router.use(requireAuth);

/**
 * Analyze a project's GitHub repository and get context source recommendations
 * POST /api/context-sources/analyze
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const data: AnalyzeProjectContextRequest = req.body;

    // Validate request
    if (!data.project_id) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Project ID is required'
      });
    }

    // Check if user has access to this project
    const hasAccess = await ProjectModel.canUserAccess(data.project_id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    // Get project details
    const project = await ProjectModel.findById(data.project_id);
    if (!project) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    // Check if project has GitHub repository connected
    if (!project.github_repo_url) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Project must have a GitHub repository connected to analyze context sources'
      });
    }

    // Analyze the repository
    const analysis = await ContextSourceService.analyzeRepository(
      data.project_id,
      project.github_repo_url
    );

    res.json({
      analysis,
      message: 'Repository analysis completed'
    });
  } catch (error) {
    console.error('Error analyzing context sources:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to analyze context sources'
    });
  }
});

/**
 * Get context source recommendations for a project
 * GET /api/context-sources/project/:projectId
 */
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

    // Get project details
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    // Check if project has GitHub repository connected
    if (!project.github_repo_url) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Project must have a GitHub repository connected'
      });
    }

    // For now, we'll always run a fresh analysis
    // In a real implementation, you'd check for cached results first
    const analysis = await ContextSourceService.analyzeRepository(
      projectId,
      project.github_repo_url
    );

    res.json({
      project_id: projectId,
      github_repo_url: project.github_repo_url,
      recommendations: analysis.recommendations,
      analyzed_at: analysis.analyzed_at,
      total_files_scanned: analysis.total_files_scanned,
      analysis_status: analysis.analysis_status
    });
  } catch (error) {
    console.error('Error fetching context sources:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch context sources'
    });
  }
});

/**
 * Update context source selections for a project
 * PUT /api/context-sources/project/:projectId/selections
 */
router.put('/project/:projectId/selections', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { projectId } = req.params;
    const data: UpdateContextSelectionRequest = req.body;

    // Validate request
    if (!data.selections || !Array.isArray(data.selections)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Selections array is required'
      });
    }

    // Check if user has access to this project
    const hasAccess = await ProjectModel.canUserAccess(projectId, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    // For now, just return success - in a real implementation,
    // you'd store these selections in the database
    console.log(`User ${user.id} updated context selections for project ${projectId}:`, data.selections);

    // Mock response showing the saved selections
    const savedSelections = data.selections.map((selection, index) => ({
      id: `selection-${index}`,
      project_id: projectId,
      file_path: selection.file_path,
      is_selected: selection.is_selected,
      selected_by: user.id,
      selected_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    }));

    res.json({
      selections: savedSelections,
      message: 'Context source selections updated successfully'
    });
  } catch (error) {
    console.error('Error updating context selections:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update context selections'
    });
  }
});

/**
 * Get current context source selections for a project
 * GET /api/context-sources/project/:projectId/selections
 */
router.get('/project/:projectId/selections', async (req: Request, res: Response) => {
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

    // For now, return empty selections - in a real implementation,
    // you'd query the database for saved selections
    res.json({
      project_id: projectId,
      selections: [],
      total: 0
    });
  } catch (error) {
    console.error('Error fetching context selections:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch context selections'
    });
  }
});

/**
 * Start repository context ingestion job
 * POST /api/context-sources/project/:projectId/ingest
 */
router.post('/project/:projectId/ingest', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { projectId } = req.params;
    const { selected_sources, force_refresh } = req.body;

    // Validate request
    if (!selected_sources || !Array.isArray(selected_sources) || selected_sources.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'selected_sources array is required and cannot be empty'
      });
    }

    // Check if user has access to this project
    const hasAccess = await ProjectModel.canUserAccess(projectId, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    // Get project details
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    // Check if project has GitHub repository connected
    if (!project.github_repo_url) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Project must have a GitHub repository connected to start ingestion'
      });
    }

    // Start the ingestion job
    const jobId = await IngestionJobService.startIngestionJob({
      project_id: projectId,
      github_repo_url: project.github_repo_url,
      selected_sources: selected_sources.map((source: any, index: number) => ({
        file_path: source.file_path,
        source_type_id: source.source_type_id,
        priority: source.priority || index + 1
      })),
      user_id: user.id,
      force_refresh: force_refresh || false
    });

    res.status(202).json({
      job_id: jobId,
      message: 'Repository context ingestion job started',
      status_url: `/api/context-sources/jobs/${jobId}`
    });

  } catch (error) {
    console.error('Error starting ingestion job:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to start ingestion job'
    });
  }
});

/**
 * Get ingestion job status
 * GET /api/context-sources/jobs/:jobId
 */
router.get('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { jobId } = req.params;

    const jobStatus = await IngestionJobService.getJobStatus(jobId);
    if (!jobStatus) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Job not found'
      });
    }

    // Check if user has access to the project this job is for
    const hasAccess = await ProjectModel.canUserAccess(jobStatus.project_id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this job'
      });
    }

    res.json({
      job: jobStatus
    });

  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch job status'
    });
  }
});

/**
 * Get ingestion jobs for a project
 * GET /api/context-sources/project/:projectId/jobs
 */
router.get('/project/:projectId/jobs', async (req: Request, res: Response) => {
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

    const jobs = await IngestionJobService.getProjectJobs(projectId);

    res.json({
      project_id: projectId,
      jobs,
      total: jobs.length
    });

  } catch (error) {
    console.error('Error fetching project jobs:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch project jobs'
    });
  }
});

export default router;