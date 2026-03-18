import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { ExportService } from '../services/ExportService';
import { requireAuth } from '../config/auth';
import { User } from '../models/types';

const router = Router();
const exportService = new ExportService(db);

// All export routes require authentication
router.use(requireAuth);

// Validation helpers
function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Create a new export batch
 * POST /api/exports/batches
 */
router.post('/batches', async (req: Request, res: Response) => {
  try {
    const { project_id, type, target_service, target_config, requirement_ids, max_retries, retry_delay_seconds } = req.body;

    // Basic validation
    if (!project_id || !isValidUUID(project_id)) {
      return res.status(400).json({ error: 'Project ID must be a valid UUID' });
    }

    if (!type || !['github_issues', 'linear_issues'].includes(type)) {
      return res.status(400).json({ error: 'Type must be github_issues or linear_issues' });
    }

    if (!target_service || !['github', 'linear'].includes(target_service)) {
      return res.status(400).json({ error: 'Target service must be github or linear' });
    }

    if (!target_config || typeof target_config !== 'object') {
      return res.status(400).json({ error: 'Target config must be an object' });
    }

    if (requirement_ids && (!Array.isArray(requirement_ids) || !requirement_ids.every(isValidUUID))) {
      return res.status(400).json({ error: 'Requirement IDs must be an array of valid UUIDs' });
    }

    if (max_retries !== undefined && (typeof max_retries !== 'number' || max_retries < 0 || max_retries > 10)) {
      return res.status(400).json({ error: 'Max retries must be between 0 and 10' });
    }

    if (retry_delay_seconds !== undefined && (typeof retry_delay_seconds !== 'number' || retry_delay_seconds < 1 || retry_delay_seconds > 3600)) {
      return res.status(400).json({ error: 'Retry delay must be between 1 and 3600 seconds' });
    }

    const batch = await exportService.createExportBatch(req.body);

    res.status(201).json({
      success: true,
      data: batch
    });
  } catch (error: any) {
    console.error('Export batch creation failed:', error);
    res.status(500).json({
      error: error.message || 'Failed to create export batch'
    });
  }
});

/**
 * Get export batch by ID
 * GET /api/exports/batches/:id
 */
router.get('/batches/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Batch ID must be a valid UUID' });
    }

    const batch = await exportService.getBatch(id);

    if (!batch) {
      return res.status(404).json({
        error: 'Export batch not found'
      });
    }

    res.json({
      success: true,
      data: batch
    });
  } catch (error: any) {
    console.error('Failed to get export batch:', error);
    res.status(500).json({
      error: error.message || 'Failed to get export batch'
    });
  }
});

/**
 * Get export batch items
 * GET /api/exports/batches/:id/items
 */
router.get('/batches/:id/items', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Batch ID must be a valid UUID' });
    }

    const items = await exportService.getBatchItems(id);

    res.json({
      success: true,
      data: items
    });
  } catch (error: any) {
    console.error('Failed to get batch items:', error);
    res.status(500).json({
      error: error.message || 'Failed to get batch items'
    });
  }
});

/**
 * Get export batches for a project
 * GET /api/exports/projects/:projectId/batches
 */
router.get('/projects/:projectId/batches', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    if (!isValidUUID(projectId)) {
      return res.status(400).json({ error: 'Project ID must be a valid UUID' });
    }

    const batches = await exportService.getBatchesForProject(projectId);

    // Apply pagination if specified
    const limit = req.query.limit ? Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100) : 50;
    const offset = req.query.offset ? Math.max(parseInt(req.query.offset as string) || 0, 0) : 0;

    const paginatedBatches = batches.slice(offset, offset + limit);

    res.json({
      success: true,
      data: paginatedBatches,
      pagination: {
        total: batches.length,
        limit,
        offset,
        has_more: offset + limit < batches.length
      }
    });
  } catch (error: any) {
    console.error('Failed to get project export batches:', error);
    res.status(500).json({
      error: error.message || 'Failed to get project export batches'
    });
  }
});

/**
 * Cancel an export batch
 * POST /api/exports/batches/:id/cancel
 */
router.post('/batches/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Batch ID must be a valid UUID' });
    }

    await exportService.cancelBatch(id);

    res.json({
      success: true,
      message: 'Export batch cancelled'
    });
  } catch (error: any) {
    console.error('Failed to cancel export batch:', error);
    res.status(500).json({
      error: error.message || 'Failed to cancel export batch'
    });
  }
});

/**
 * Create GitHub export batch (convenience endpoint)
 * POST /api/exports/github
 */
router.post('/github', async (req: Request, res: Response) => {
  try {
    const { project_id, requirement_ids, repository, labels, assignees, milestone, template } = req.body;

    // Validation
    if (!project_id || !isValidUUID(project_id)) {
      return res.status(400).json({ error: 'Project ID must be a valid UUID' });
    }

    if (!repository || !repository.owner || !repository.name) {
      return res.status(400).json({ error: 'Repository owner and name are required' });
    }

    if (typeof repository.owner !== 'string' || repository.owner.length === 0 || repository.owner.length > 255) {
      return res.status(400).json({ error: 'Repository owner must be a non-empty string' });
    }

    if (typeof repository.name !== 'string' || repository.name.length === 0 || repository.name.length > 255) {
      return res.status(400).json({ error: 'Repository name must be a non-empty string' });
    }

    if (requirement_ids && (!Array.isArray(requirement_ids) || !requirement_ids.every(isValidUUID))) {
      return res.status(400).json({ error: 'Requirement IDs must be an array of valid UUIDs' });
    }

    if (labels && !Array.isArray(labels)) {
      return res.status(400).json({ error: 'Labels must be an array' });
    }

    if (assignees && !Array.isArray(assignees)) {
      return res.status(400).json({ error: 'Assignees must be an array' });
    }

    if (template && typeof template !== 'object') {
      return res.status(400).json({ error: 'Template must be an object' });
    }

    const exportBatchData = {
      project_id,
      type: 'github_issues' as const,
      target_service: 'github' as const,
      target_config: {
        repository,
        labels,
        assignees,
        milestone,
        template
      },
      requirement_ids
    };

    const batch = await exportService.createExportBatch(exportBatchData);

    res.status(201).json({
      success: true,
      data: batch,
      message: 'GitHub export batch created successfully'
    });
  } catch (error: any) {
    console.error('GitHub export batch creation failed:', error);
    res.status(500).json({
      error: error.message || 'Failed to create GitHub export batch'
    });
  }
});

export { router as exportsRouter };