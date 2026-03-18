import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db } from '../config/database';
import { ExportService } from '../services/ExportService';
import { requireAuth } from '../middleware/auth';

const router = express.Router();
const exportService = new ExportService(db);

/**
 * Create a new export batch
 * POST /api/exports/batches
 */
router.post('/batches',
  requireAuth,
  [
    body('project_id')
      .isUUID()
      .withMessage('Project ID must be a valid UUID'),
    body('type')
      .isIn(['github_issues', 'linear_issues'])
      .withMessage('Type must be github_issues or linear_issues'),
    body('target_service')
      .isIn(['github', 'linear'])
      .withMessage('Target service must be github or linear'),
    body('target_config')
      .isObject()
      .withMessage('Target config must be an object'),
    body('requirement_ids')
      .optional()
      .isArray()
      .withMessage('Requirement IDs must be an array'),
    body('requirement_ids.*')
      .optional()
      .isUUID()
      .withMessage('Each requirement ID must be a valid UUID'),
    body('max_retries')
      .optional()
      .isInt({ min: 0, max: 10 })
      .withMessage('Max retries must be between 0 and 10'),
    body('retry_delay_seconds')
      .optional()
      .isInt({ min: 1, max: 3600 })
      .withMessage('Retry delay must be between 1 and 3600 seconds')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
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
  }
);

/**
 * Get export batch by ID
 * GET /api/exports/batches/:id
 */
router.get('/batches/:id',
  requireAuth,
  [
    param('id')
      .isUUID()
      .withMessage('Batch ID must be a valid UUID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const batch = await exportService.getBatch(req.params.id);

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
  }
);

/**
 * Get export batch items
 * GET /api/exports/batches/:id/items
 */
router.get('/batches/:id/items',
  requireAuth,
  [
    param('id')
      .isUUID()
      .withMessage('Batch ID must be a valid UUID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const items = await exportService.getBatchItems(req.params.id);

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
  }
);

/**
 * Get export batches for a project
 * GET /api/exports/projects/:projectId/batches
 */
router.get('/projects/:projectId/batches',
  requireAuth,
  [
    param('projectId')
      .isUUID()
      .withMessage('Project ID must be a valid UUID'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be non-negative')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const batches = await exportService.getBatchesForProject(req.params.projectId);

      // Apply pagination if specified
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

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
  }
);

/**
 * Cancel an export batch
 * POST /api/exports/batches/:id/cancel
 */
router.post('/batches/:id/cancel',
  requireAuth,
  [
    param('id')
      .isUUID()
      .withMessage('Batch ID must be a valid UUID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      await exportService.cancelBatch(req.params.id);

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
  }
);

/**
 * Create GitHub export batch (convenience endpoint)
 * POST /api/exports/github
 */
router.post('/github',
  requireAuth,
  [
    body('project_id')
      .isUUID()
      .withMessage('Project ID must be a valid UUID'),
    body('repository.owner')
      .isLength({ min: 1, max: 255 })
      .withMessage('Repository owner is required'),
    body('repository.name')
      .isLength({ min: 1, max: 255 })
      .withMessage('Repository name is required'),
    body('requirement_ids')
      .optional()
      .isArray()
      .withMessage('Requirement IDs must be an array'),
    body('labels')
      .optional()
      .isArray()
      .withMessage('Labels must be an array'),
    body('assignees')
      .optional()
      .isArray()
      .withMessage('Assignees must be an array'),
    body('template.title_prefix')
      .optional()
      .isString()
      .withMessage('Title prefix must be a string'),
    body('template.body_template')
      .optional()
      .isString()
      .withMessage('Body template must be a string')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      // Extract GitHub-specific config
      const { project_id, requirement_ids, repository, labels, assignees, milestone, template } = req.body;

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
  }
);

export { router as exportsRouter };