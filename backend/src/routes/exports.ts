import { Router, Request, Response } from 'express';
import { requireAuth } from '../config/auth';
import { ExportJobModel } from '../models/ExportJob';
import { RequirementModel } from '../models/Requirement';
import { ProjectModel } from '../models/Project';
import { WorkspaceModel } from '../models/Workspace';
import { CreateExportRequest, ExportConfirmationRequest, User } from '../models/types';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-writer';

const router = Router();

// All export routes require authentication
router.use(requireAuth);

// Create new export job
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const data: CreateExportRequest = req.body;

    // Basic validation
    if (!data.name || data.name.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Export name is required'
      });
    }

    if (!data.export_type || !['requirements', 'projects', 'workspace'].includes(data.export_type)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Export type must be requirements, projects, or workspace'
      });
    }

    if (data.format && !['csv', 'json', 'xlsx'].includes(data.format)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Format must be csv, json, or xlsx'
      });
    }

    // Validate access to workspace/project
    if (data.workspace_id) {
      const hasAccess = await WorkspaceModel.canUserAccess(data.workspace_id, user.id);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'You do not have access to this workspace'
        });
      }
    }

    if (data.project_id) {
      const hasAccess = await ProjectModel.canUserAccess(data.project_id, user.id);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'You do not have access to this project'
        });
      }
    }

    // Clean up data
    const cleanData: CreateExportRequest = {
      name: data.name.trim(),
      description: data.description?.trim(),
      export_type: data.export_type,
      format: data.format || 'csv',
      workspace_id: data.workspace_id,
      project_id: data.project_id,
      filters: data.filters || {},
      columns: data.columns || [],
      options: data.options || {}
    };

    const exportJob = await ExportJobModel.create(cleanData, user.id);

    // Start export processing asynchronously
    processExportJob(exportJob.id);

    res.status(201).json({
      export_job: exportJob,
      message: 'Export job created successfully'
    });
  } catch (error) {
    console.error('Error creating export job:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create export job'
    });
  }
});

// Get export job details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user can access this export
    const hasAccess = await ExportJobModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this export job'
      });
    }

    const exportJob = await ExportJobModel.findByIdWithDetails(id);
    if (!exportJob) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Export job not found'
      });
    }

    res.json({
      export_job: exportJob
    });
  } catch (error) {
    console.error('Error fetching export job:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch export job'
    });
  }
});

// Get export history for user
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const page = parseInt(req.query.page as string) || 1;
    const per_page = Math.min(parseInt(req.query.per_page as string) || 20, 100);
    const workspace_id = req.query.workspace_id as string;
    const project_id = req.query.project_id as string;

    const history = await ExportJobModel.findByScope(
      user.id,
      workspace_id,
      project_id,
      page,
      per_page
    );

    res.json(history);
  } catch (error) {
    console.error('Error fetching export history:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch export history'
    });
  }
});

// Confirm export completion
router.post('/:id/confirm', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const data: ExportConfirmationRequest = req.body;

    // Check if user can access this export
    const hasAccess = await ExportJobModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this export job'
      });
    }

    // Check if export is completed
    const exportJob = await ExportJobModel.findById(id);
    if (!exportJob) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Export job not found'
      });
    }

    if (exportJob.status !== 'completed') {
      return res.status(400).json({
        error: 'Invalid Status',
        message: 'Cannot confirm an export that is not completed'
      });
    }

    // Validate satisfaction rating
    if (data.satisfaction_rating !== undefined) {
      if (data.satisfaction_rating < 1 || data.satisfaction_rating > 5) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Satisfaction rating must be between 1 and 5'
        });
      }
    }

    const confirmation = await ExportJobModel.createConfirmation(id, user.id, data);

    res.json({
      confirmation,
      message: 'Export confirmed successfully'
    });
  } catch (error) {
    console.error('Error confirming export:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to confirm export'
    });
  }
});

// Download export file
router.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user can access this export
    const hasAccess = await ExportJobModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this export job'
      });
    }

    const exportJob = await ExportJobModel.findById(id);
    if (!exportJob) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Export job not found'
      });
    }

    if (exportJob.status !== 'completed' || !exportJob.file_path) {
      return res.status(400).json({
        error: 'Invalid Status',
        message: 'Export file is not available for download'
      });
    }

    // Check if file exists
    if (!fs.existsSync(exportJob.file_path)) {
      return res.status(404).json({
        error: 'File Not Found',
        message: 'Export file has been removed or is no longer available'
      });
    }

    // Track download
    await ExportJobModel.trackDownload(id, user.id);

    // Set appropriate headers for download
    const filename = path.basename(exportJob.file_path);
    const ext = path.extname(filename).toLowerCase();

    let contentType = 'application/octet-stream';
    if (ext === '.csv') {
      contentType = 'text/csv';
    } else if (ext === '.json') {
      contentType = 'application/json';
    } else if (ext === '.xlsx') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', exportJob.file_size_bytes || 0);

    // Stream the file
    const fileStream = fs.createReadStream(exportJob.file_path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading export:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to download export file'
    });
  }
});

// Cancel export job
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if user can access this export
    const hasAccess = await ExportJobModel.canUserAccess(id, user.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have access to this export job'
      });
    }

    const exportJob = await ExportJobModel.findById(id);
    if (!exportJob) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Export job not found'
      });
    }

    if (!['pending', 'processing'].includes(exportJob.status)) {
      return res.status(400).json({
        error: 'Invalid Status',
        message: 'Cannot cancel an export that is not pending or processing'
      });
    }

    const updatedJob = await ExportJobModel.updateStatus(id, 'cancelled');

    res.json({
      export_job: updatedJob,
      message: 'Export job cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling export job:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to cancel export job'
    });
  }
});

// Get export statistics
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const workspace_id = req.query.workspace_id as string;

    const stats = await ExportJobModel.getStats(user.id, workspace_id);

    res.json(stats);
  } catch (error) {
    console.error('Error fetching export stats:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch export statistics'
    });
  }
});

// Mark notification as read
router.patch('/notifications/:notification_id/read', async (req: Request, res: Response) => {
  try {
    const { notification_id } = req.params;

    const success = await ExportJobModel.markNotificationRead(notification_id);

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Notification not found or already read'
      });
    }

    res.json({
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to mark notification as read'
    });
  }
});

// Export processing function (runs asynchronously)
async function processExportJob(exportJobId: string) {
  try {
    // Update status to processing
    await ExportJobModel.updateStatus(exportJobId, 'processing', 0);

    const exportJob = await ExportJobModel.findById(exportJobId);
    if (!exportJob) {
      throw new Error('Export job not found');
    }

    let data: any[] = [];
    let filename: string;

    // Fetch data based on export type
    if (exportJob.export_type === 'requirements') {
      if (exportJob.project_id) {
        data = await RequirementModel.findByProjectId(exportJob.project_id);
      } else if (exportJob.workspace_id) {
        // Get all requirements in workspace
        data = await RequirementModel.findByUserId(exportJob.user_id);
        // Filter by workspace if needed
        data = data.filter(req => req.project?.workspace_id === exportJob.workspace_id);
      } else {
        data = await RequirementModel.findByUserId(exportJob.user_id);
      }
      filename = `requirements_export_${Date.now()}`;
    } else if (exportJob.export_type === 'projects') {
      if (exportJob.workspace_id) {
        data = await ProjectModel.findByWorkspaceId(exportJob.workspace_id);
      } else {
        data = await ProjectModel.findByUserId(exportJob.user_id);
      }
      filename = `projects_export_${Date.now()}`;
    } else {
      // workspace export - include both projects and requirements
      data = {
        projects: exportJob.workspace_id
          ? await ProjectModel.findByWorkspaceId(exportJob.workspace_id)
          : await ProjectModel.findByUserId(exportJob.user_id),
        requirements: exportJob.workspace_id
          ? (await RequirementModel.findByUserId(exportJob.user_id))
              .filter(req => req.project?.workspace_id === exportJob.workspace_id)
          : await RequirementModel.findByUserId(exportJob.user_id)
      };
      filename = `workspace_export_${Date.now()}`;
    }

    // Update progress
    await ExportJobModel.updateStatus(exportJobId, 'processing', 50);

    // Create exports directory if it doesn't exist
    const exportsDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Generate file based on format
    let filePath: string;
    let fileSize: number;

    if (exportJob.format === 'csv') {
      filePath = await generateCSVFile(data, filename, exportsDir, exportJob.export_type);
    } else if (exportJob.format === 'json') {
      filePath = await generateJSONFile(data, filename, exportsDir);
    } else {
      throw new Error('Unsupported export format');
    }

    const stats = fs.statSync(filePath);
    fileSize = stats.size;

    // Update progress and mark as completed
    await ExportJobModel.updateStatus(
      exportJobId,
      'completed',
      100,
      undefined,
      filePath,
      fileSize,
      Array.isArray(data) ? data.length : (data.projects?.length || 0) + (data.requirements?.length || 0)
    );
  } catch (error) {
    console.error('Error processing export job:', error);
    await ExportJobModel.updateStatus(
      exportJobId,
      'failed',
      undefined,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

// Helper function to generate CSV file
async function generateCSVFile(data: any[], filename: string, dir: string, exportType: string): Promise<string> {
  const filePath = path.join(dir, `${filename}.csv`);

  if (exportType === 'requirements') {
    const csvWriter = csv.createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'title', title: 'Title' },
        { id: 'description', title: 'Description' },
        { id: 'priority', title: 'Priority' },
        { id: 'type', title: 'Type' },
        { id: 'status', title: 'Status' },
        { id: 'project_name', title: 'Project' },
        { id: 'author_name', title: 'Author' },
        { id: 'github_issue_url', title: 'GitHub Issue' },
        { id: 'created_at', title: 'Created At' },
        { id: 'updated_at', title: 'Updated At' }
      ]
    });

    const records = data.map(req => ({
      id: req.id,
      title: req.title,
      description: req.description || '',
      priority: req.priority,
      type: req.type,
      status: req.status,
      project_name: req.project?.name || '',
      author_name: req.author?.name || req.author?.username || '',
      github_issue_url: req.github_issue_url || '',
      created_at: req.created_at,
      updated_at: req.updated_at
    }));

    await csvWriter.writeRecords(records);
  } else if (exportType === 'projects') {
    const csvWriter = csv.createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'name', title: 'Name' },
        { id: 'description', title: 'Description' },
        { id: 'status', title: 'Status' },
        { id: 'product_area', title: 'Product Area' },
        { id: 'workspace_name', title: 'Workspace' },
        { id: 'owner_name', title: 'Owner' },
        { id: 'created_at', title: 'Created At' },
        { id: 'updated_at', title: 'Updated At' }
      ]
    });

    const records = data.map(proj => ({
      id: proj.id,
      name: proj.name,
      description: proj.description || '',
      status: proj.status,
      product_area: proj.product_area || '',
      workspace_name: proj.workspace?.name || '',
      owner_name: proj.owner?.name || proj.owner?.username || '',
      created_at: proj.created_at,
      updated_at: proj.updated_at
    }));

    await csvWriter.writeRecords(records);
  }

  return filePath;
}

// Helper function to generate JSON file
async function generateJSONFile(data: any, filename: string, dir: string): Promise<string> {
  const filePath = path.join(dir, `${filename}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

export default router;