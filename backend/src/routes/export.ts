import { Router, Request, Response } from 'express';
import { requireAuth } from '../config/auth';
import { db } from '../config/database';
import { ProjectModel } from '../models/Project';
import { ExportBatchModel } from '../models/ExportBatch';
import { ExportService } from '../services/ExportService';
import {
  User,
  CreateExportBatchRequest
} from '../models/types';

const router = Router();

// All export routes require authentication
router.use(requireAuth);

// Get export history for a project
router.get('/projects/:projectId/exports', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { projectId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Check if user has access to this project
    const hasAccess = await ProjectModel.canUserAccess(projectId, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    const history = await ExportService.getExportHistory(projectId, limit, offset);

    res.json(history);
  } catch (error) {
    console.error('Error fetching export history:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch export history'
    });
  }
});

// Create a new export batch
router.post('/projects/:projectId/exports', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { projectId } = req.params;
    const data: CreateExportBatchRequest = req.body;

    // Check if user has access to this project (members can create exports)
    const hasAccess = await ProjectModel.canUserAccess(projectId, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this project'
      });
    }

    // Validate required fields
    if (!data.name || !data.requirement_ids || data.requirement_ids.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Export name and requirement IDs are required'
      });
    }

    if (!data.target_type || !data.target_config) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Export target type and configuration are required'
      });
    }

    // Validate export configuration
    const configValidation = await ExportService.validateExportConfig(
      projectId,
      data.target_type,
      data.target_config
    );

    if (!configValidation.valid) {
      return res.status(400).json({
        error: 'Configuration Error',
        message: configValidation.error
      });
    }

    // Verify all requirements belong to this project
    const requirementCheck = await Promise.all(
      data.requirement_ids.map(async (reqId) => {
        const result = await db.query('SELECT project_id FROM requirements WHERE id = $1', [reqId]);
        return result.rows[0]?.project_id === projectId;
      })
    );

    if (requirementCheck.includes(false)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Some requirements do not belong to this project'
      });
    }

    // Create the export batch
    const batch = await ExportBatchModel.create(data, user.id, projectId);

    res.status(201).json({
      batch,
      message: 'Export batch created successfully'
    });
  } catch (error) {
    console.error('Error creating export batch:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create export batch'
    });
  }
});

// Get export batch details
router.get('/exports/:batchId', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { batchId } = req.params;

    const batch = await ExportBatchModel.findByIdWithItems(batchId);
    if (!batch) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Export batch not found'
      });
    }

    // Check if user has access to the project
    const hasAccess = await ProjectModel.canUserAccess(batch.project_id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this export batch'
      });
    }

    res.json({ batch });
  } catch (error) {
    console.error('Error fetching export batch:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch export batch'
    });
  }
});

// Start/process an export batch
router.post('/exports/:batchId/process', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { batchId } = req.params;

    const batch = await ExportBatchModel.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Export batch not found'
      });
    }

    // Check if user has access to the project
    const hasAccess = await ProjectModel.canUserAccess(batch.project_id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this export batch'
      });
    }

    if (batch.status !== 'pending') {
      return res.status(400).json({
        error: 'Invalid State',
        message: 'Export batch is not in pending state'
      });
    }

    // Process the batch asynchronously
    ExportService.processBatch(batchId).catch(error => {
      console.error(`Background processing of batch ${batchId} failed:`, error);
    });

    res.json({
      message: 'Export batch processing started'
    });
  } catch (error) {
    console.error('Error starting export batch processing:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to start export batch processing'
    });
  }
});

// Retry failed items in an export batch
router.post('/exports/:batchId/retry', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { batchId } = req.params;

    const batch = await ExportBatchModel.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Export batch not found'
      });
    }

    // Check if user has access to the project
    const hasAccess = await ProjectModel.canUserAccess(batch.project_id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this export batch'
      });
    }

    if (!['failed', 'partially_completed'].includes(batch.status)) {
      return res.status(400).json({
        error: 'Invalid State',
        message: 'Export batch has no failed items to retry'
      });
    }

    // Retry failed items asynchronously
    ExportService.retryFailedItems(batchId).catch(error => {
      console.error(`Retry processing of batch ${batchId} failed:`, error);
    });

    res.json({
      message: 'Retrying failed export items'
    });
  } catch (error) {
    console.error('Error retrying export batch:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retry export batch'
    });
  }
});

// Delete an export batch
router.delete('/exports/:batchId', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { batchId } = req.params;

    const batch = await ExportBatchModel.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Export batch not found'
      });
    }

    // Check if user owns the project (only owners can delete export batches)
    const isOwner = await ProjectModel.isUserOwner(batch.project_id, user.id);
    if (!isOwner) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'Only project owners can delete export batches'
      });
    }

    // Don't allow deletion of in-progress batches
    if (batch.status === 'in_progress') {
      return res.status(400).json({
        error: 'Invalid State',
        message: 'Cannot delete export batch that is currently processing'
      });
    }

    const deleted = await ExportBatchModel.delete(batchId);
    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Export batch not found'
      });
    }

    res.json({
      message: 'Export batch deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting export batch:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete export batch'
    });
  }
});

// Get export batch statistics
router.get('/exports/:batchId/stats', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { batchId } = req.params;

    const batch = await ExportBatchModel.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Export batch not found'
      });
    }

    // Check if user has access to the project
    const hasAccess = await ProjectModel.canUserAccess(batch.project_id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this export batch'
      });
    }

    const stats = await ExportBatchModel.getStats(batchId);

    res.json({
      stats: {
        ...stats,
        success_rate: stats.total > 0 ? (stats.completed / stats.total * 100).toFixed(1) + '%' : '0%'
      }
    });
  } catch (error) {
    console.error('Error fetching export batch statistics:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch export batch statistics'
    });
  }
});

export default router;