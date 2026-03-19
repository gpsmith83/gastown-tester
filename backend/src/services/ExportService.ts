<<<<<<< HEAD
import { ExportBatchModel } from '../models/ExportBatch';
import { LinearConnectionModel } from '../models/LinearConnection';
import { LinearService } from './LinearService';
import { db } from '../config/database';
import {
  ExportBatch,
  ExportBatchItem,
  Requirement,
  LinearExportResult
} from '../models/types';

export class ExportService {

  // Process a single export batch
  static async processBatch(batchId: string): Promise<void> {
    const batch = await ExportBatchModel.findByIdWithItems(batchId);
    if (!batch) {
      throw new Error(`Export batch ${batchId} not found`);
    }

    if (batch.status !== 'pending') {
      throw new Error(`Export batch ${batchId} is not in pending status`);
    }

    try {
      // Mark batch as in progress
      await ExportBatchModel.updateStatus(batchId, 'in_progress');

      // Process based on target type
      switch (batch.target_type) {
        case 'linear':
          await this.processLinearBatch(batch);
          break;
        default:
          throw new Error(`Unsupported export target type: ${batch.target_type}`);
      }

      // Update final batch status based on results
      await this.updateBatchFinalStatus(batchId);

    } catch (error) {
      console.error(`Error processing batch ${batchId}:`, error);
      await ExportBatchModel.updateStatus(
        batchId,
        'failed',
        undefined,
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  // Process Linear-specific export batch
  private static async processLinearBatch(batch: ExportBatch & { items: ExportBatchItem[] }): Promise<void> {
    // Get Linear connection for the project
    const linearConnection = await LinearConnectionModel.findByProjectId(batch.project_id);
    if (!linearConnection || !linearConnection.is_validated) {
      throw new Error('No validated Linear connection found for this project');
    }

    // SECURITY: API tokens should never be stored in batch configuration
    // They must be provided securely at processing time
    // TODO: Implement secure token retrieval from request context or encrypted storage
    const apiToken = batch.target_config.api_token;
    if (!apiToken) {
      throw new Error('Linear API token not provided. Tokens must be supplied securely at processing time.');
    }

    // Verify token matches the stored connection
    const tokenValid = await LinearConnectionModel.verifyToken(batch.project_id, apiToken);
    if (!tokenValid) {
      throw new Error('Provided API token does not match stored Linear connection');
    }

    const targetConfig = batch.target_config;
    const teamId = targetConfig.team_id || linearConnection.team_id;
    const projectIdLinear = targetConfig.project_id_linear || linearConnection.project_id_linear;

    // Process each item in the batch
    for (const item of batch.items) {
      if (item.status !== 'pending') {
        continue; // Skip already processed items
      }

      try {
        // Mark item as in progress
        await ExportBatchModel.updateItemStatus(item.id, 'in_progress');

        // Get the requirement details
        const requirement = await this.getRequirement(item.requirement_id);
        if (!requirement) {
          throw new Error(`Requirement ${item.requirement_id} not found`);
        }

        // Export to Linear
        const result = await this.exportRequirementToLinear(
          requirement,
          apiToken,
          teamId,
          projectIdLinear,
          targetConfig
        );

        if (result.success && result.issue_id) {
          // Mark item as completed
          await ExportBatchModel.updateItemStatus(
            item.id,
            'completed',
            result.issue_id,
            result.issue_url
          );
        } else {
          // Mark item as failed
          await ExportBatchModel.updateItemStatus(
            item.id,
            'failed',
            undefined,
            undefined,
            result.error || 'Unknown export error'
          );
        }

      } catch (error) {
        console.error(`Error exporting requirement ${item.requirement_id}:`, error);
        await ExportBatchModel.updateItemStatus(
          item.id,
          'failed',
          undefined,
          undefined,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  }

  // Export a single requirement to Linear
  private static async exportRequirementToLinear(
    requirement: Requirement,
    apiToken: string,
    teamId: string,
    projectIdLinear?: string,
    targetConfig: any = {}
  ): Promise<LinearExportResult> {
    try {
      // Prepare issue data
      const issueData = {
        title: requirement.title,
        description: requirement.description || undefined,
        teamId: teamId,
        projectId: projectIdLinear,
        priority: targetConfig.default_priority || requirement.priority,
        labelIds: targetConfig.default_labels || [],
      };

      // Create the issue in Linear
      const result = await LinearService.createIssue(apiToken, issueData);

      if (result.success && result.issue) {
        return {
          success: true,
          issue_id: result.issue.id,
          issue_identifier: result.issue.identifier,
          issue_url: result.issue.url,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Unknown Linear API error',
          retry_recommended: true, // Most API errors can be retried
        };
      }

    } catch (error) {
      console.error('Error creating Linear issue:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retry_recommended: true,
      };
    }
  }

  // Get requirement by ID
  private static async getRequirement(requirementId: string): Promise<Requirement | null> {
    const result = await db.query(
      'SELECT * FROM requirements WHERE id = $1',
      [requirementId]
    );

    return result.rows[0] || null;
  }

  // Update final batch status based on item results
  private static async updateBatchFinalStatus(batchId: string): Promise<void> {
    const stats = await ExportBatchModel.getStats(batchId);

    let finalStatus: string;
    if (stats.failed === 0) {
      finalStatus = 'completed';
    } else if (stats.completed === 0) {
      finalStatus = 'failed';
    } else {
      finalStatus = 'partially_completed';
    }

    await ExportBatchModel.updateStatus(
      batchId,
      finalStatus,
      stats.completed,
      stats.failed
    );
  }

  // Retry failed items in a batch
  static async retryFailedItems(batchId: string): Promise<void> {
    const retryableItems = await ExportBatchModel.findRetryableItems(batchId);

    if (retryableItems.length === 0) {
      return;
    }

    const batch = await ExportBatchModel.findById(batchId);
    if (!batch) {
      throw new Error(`Export batch ${batchId} not found`);
    }

    // Reset the retryable items to pending status
    for (const item of retryableItems) {
      await ExportBatchModel.updateItemStatus(
        item.id,
        'pending',
        undefined,
        undefined,
        undefined // Clear previous error
      );
    }

    // Reset batch to pending if it was failed/partially_completed
    if (['failed', 'partially_completed'].includes(batch.status)) {
      await ExportBatchModel.updateStatus(batchId, 'pending');
    }

    // Process the batch again
    await this.processBatch(batchId);
  }

  // Validate export configuration before creating batch
  static async validateExportConfig(
    projectId: string,
    targetType: string,
    targetConfig: any
  ): Promise<{ valid: boolean; error?: string }> {
    switch (targetType) {
      case 'linear':
        return await this.validateLinearConfig(projectId, targetConfig);
      default:
        return { valid: false, error: `Unsupported target type: ${targetType}` };
    }
  }

  // Validate Linear export configuration
  private static async validateLinearConfig(
    projectId: string,
    config: any
  ): Promise<{ valid: boolean; error?: string }> {
    // Check if Linear connection exists
    const connection = await LinearConnectionModel.findByProjectId(projectId);
    if (!connection || !connection.is_validated) {
      return {
        valid: false,
        error: 'No validated Linear connection found for this project'
      };
    }

    // Validate required fields
    const teamId = config.team_id || connection.team_id;
    if (!teamId) {
      return {
        valid: false,
        error: 'Team ID is required for Linear export'
      };
    }

    // API token validation would happen at runtime when processing
    // since we don't store the actual token

    return { valid: true };
  }

  // Get export history for a project
  static async getExportHistory(
    projectId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{
    batches: any[];
    total: number;
  }> {
    const countResult = await db.query(
      'SELECT COUNT(*) FROM export_batches WHERE project_id = $1',
      [projectId]
    );

    const total = parseInt(countResult.rows[0].count);

    const batchesResult = await db.query(
      `SELECT eb.*, u.username as created_by_username
       FROM export_batches eb
       JOIN users u ON u.id = eb.created_by
       WHERE eb.project_id = $1
       ORDER BY eb.created_at DESC
       LIMIT $2 OFFSET $3`,
      [projectId, limit, offset]
    );

    const batches = batchesResult.rows.map(batch => {
      if (batch.target_config) {
        try {
          batch.target_config = JSON.parse(batch.target_config);
        } catch {
          batch.target_config = {};
        }
      }
      return batch;
    });

    return { batches, total };
=======
import { Pool } from 'pg';
import { ExportBatchModel } from '../models/ExportBatch';
import { RequirementModel } from '../models/Requirement';
import {
  ExportBatch,
  ExportBatchItem,
  CreateExportBatchRequest,
  Requirement,
  GitHubExportConfig,
  LinearExportConfig
} from '../models/types';
import { GitHubExporter } from './exporters/GitHubExporter';
import { LinearExporter } from './exporters/LinearExporter';

export interface ExportResult {
  success: boolean;
  external_id?: string;
  external_url?: string;
  export_data?: Record<string, any>;
  error?: string;
}

export interface IExporter {
  exportRequirement(requirement: Requirement, config: any): Promise<ExportResult>;
  validateConfig(config: any): Promise<{ valid: boolean; error?: string }>;
}

/**
 * Export Service - Coordinates export batches and retry logic (B-505, B-506)
 * Implements the export batch system foundation (B-503)
 */
export class ExportService {
  private db: Pool;
  private exportBatchModel: ExportBatchModel;
  private exporters: Map<string, IExporter>;

  constructor(db: Pool) {
    this.db = db;
    this.exportBatchModel = new ExportBatchModel(db);
    this.exporters = new Map();

    // Register exporters
    this.exporters.set('github', new GitHubExporter());
    this.exporters.set('linear', new LinearExporter());
  }

  /**
   * Create and start an export batch
   */
  async createExportBatch(data: CreateExportBatchRequest): Promise<ExportBatch> {
    // Validate target service
    if (!this.exporters.has(data.target_service)) {
      throw new Error(`Unsupported target service: ${data.target_service}`);
    }

    // Validate configuration
    const exporter = this.exporters.get(data.target_service)!;
    const configValidation = await exporter.validateConfig(data.target_config);
    if (!configValidation.valid) {
      throw new Error(`Invalid configuration: ${configValidation.error}`);
    }

    // Create the batch
    const batch = await this.exportBatchModel.create(data);

    // Get requirements to export
    let requirements: Requirement[];
    if (data.requirement_ids && data.requirement_ids.length > 0) {
      // Export specific requirements
      requirements = await RequirementModel.findByIds(data.requirement_ids);
      if (requirements.length !== data.requirement_ids.length) {
        throw new Error('Some requirements not found');
      }
    } else {
      // Export all active requirements in the project
      requirements = await RequirementModel.findByProjectIdFiltered(data.project_id, {
        status: 'active',
        is_active: true
      });
    }

    // Create batch items
    const batchItems = requirements.map(req => ({
      source_type: 'requirement',
      source_id: req.id
    }));

    await this.exportBatchModel.createBatchItems(batch.id, batchItems);

    // Update total items count
    await this.exportBatchModel.updateStatus(batch.id, 'pending', {
      total_items: requirements.length
    });

    // Start processing in background
    this.processBatch(batch.id).catch(error => {
      console.error('Export batch processing failed:', error);
      this.exportBatchModel.updateStatus(batch.id, 'failed', {
        error_message: error.message,
        completed_at: new Date()
      });
    });

    return this.exportBatchModel.getById(batch.id) as Promise<ExportBatch>;
  }

  /**
   * Process an export batch
   */
  async processBatch(batchId: string): Promise<void> {
    const batch = await this.exportBatchModel.getById(batchId);
    if (!batch) {
      throw new Error(`Export batch not found: ${batchId}`);
    }

    // Mark as processing
    await this.exportBatchModel.updateStatus(batch.id, 'processing', {
      started_at: new Date()
    });

    const items = await this.exportBatchModel.getBatchItems(batchId);
    const exporter = this.exporters.get(batch.target_service);
    if (!exporter) {
      throw new Error(`Exporter not found for service: ${batch.target_service}`);
    }

    let processedCount = 0;
    let failedCount = 0;

    for (const item of items) {
      try {
        await this.processItem(batch, item, exporter);
        processedCount++;
      } catch (error) {
        console.error(`Failed to process item ${item.id}:`, error);
        failedCount++;
      }

      // Update batch progress
      await this.exportBatchModel.updateStatus(batch.id, 'processing', {
        processed_items: processedCount,
        failed_items: failedCount
      });
    }

    // Mark batch as completed or failed
    const finalStatus = failedCount === 0 ? 'completed' :
                       processedCount === 0 ? 'failed' : 'completed';

    await this.exportBatchModel.updateStatus(batch.id, finalStatus, {
      completed_at: new Date(),
      error_message: failedCount > 0 ? `${failedCount} items failed` : undefined
    });
  }

  /**
   * Process a single batch item
   */
  private async processItem(
    batch: ExportBatch,
    item: ExportBatchItem,
    exporter: IExporter
  ): Promise<void> {
    // Mark item as processing
    await this.exportBatchModel.updateBatchItem(item.id, {
      status: 'processing',
      started_at: new Date()
    });

    try {
      // Get the requirement
      const requirement = await RequirementModel.findById(item.source_id);
      if (!requirement) {
        throw new Error(`Requirement not found: ${item.source_id}`);
      }

      // Export the requirement
      const result = await exporter.exportRequirement(requirement, batch.target_config);

      if (result.success) {
        await this.exportBatchModel.updateBatchItem(item.id, {
          status: 'completed',
          external_id: result.external_id,
          external_url: result.external_url,
          export_data: result.export_data || {},
          completed_at: new Date()
        });
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error: any) {
      await this.exportBatchModel.updateBatchItem(item.id, {
        status: 'failed',
        error_message: error.message,
        completed_at: new Date()
      });

      // Schedule retry if within retry limits
      if (item.retry_count < batch.max_retries) {
        await this.scheduleItemRetry(batch, item, error.message);
      }
    }
  }

  /**
   * Schedule an item for retry (B-506 retry logic)
   */
  private async scheduleItemRetry(
    batch: ExportBatch,
    item: ExportBatchItem,
    errorMessage: string
  ): Promise<void> {
    const newRetryCount = item.retry_count + 1;
    const retryDelayMs = this.calculateRetryDelay(newRetryCount, batch.retry_delay_seconds);
    const nextRetryAt = new Date(Date.now() + retryDelayMs);

    await this.exportBatchModel.updateBatchItem(item.id, {
      status: 'pending', // Reset to pending for retry
      retry_count: newRetryCount,
      error_message: `Retry ${newRetryCount}/${batch.max_retries}: ${errorMessage}`
    });

    // Update batch to retrying status
    await this.exportBatchModel.updateStatus(batch.id, 'retrying', {
      next_retry_at: nextRetryAt
    });
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number, baseDelaySeconds: number): number {
    // Exponential backoff: delay = baseDelay * 2^(retryCount - 1)
    // Example: 30s, 60s, 120s, 240s...
    const delaySeconds = baseDelaySeconds * Math.pow(2, retryCount - 1);
    return delaySeconds * 1000; // Convert to milliseconds
  }

  /**
   * Process retry batches (called by background job)
   */
  async processRetryBatches(): Promise<void> {
    const retryBatches = await this.exportBatchModel.getBatchesReadyForRetry();

    for (const batch of retryBatches) {
      try {
        console.log(`Processing retry for batch ${batch.id}, attempt ${batch.retry_count + 1}`);
        await this.processBatch(batch.id);
      } catch (error) {
        console.error(`Failed to process retry batch ${batch.id}:`, error);

        // Update retry count and schedule next retry if within limits
        if (batch.retry_count < batch.max_retries) {
          const newRetryCount = batch.retry_count + 1;
          const retryDelayMs = this.calculateRetryDelay(newRetryCount, batch.retry_delay_seconds);
          const nextRetryAt = new Date(Date.now() + retryDelayMs);

          await this.exportBatchModel.updateStatus(batch.id, 'retrying', {
            retry_count: newRetryCount,
            next_retry_at: nextRetryAt,
            error_message: error instanceof Error ? error.message : 'Unknown error'
          });
        } else {
          // Max retries exceeded, mark as failed
          await this.exportBatchModel.updateStatus(batch.id, 'failed', {
            error_message: `Max retries exceeded: ${error instanceof Error ? error.message : 'Unknown error'}`,
            completed_at: new Date()
          });
        }
      }
    }
  }

  /**
   * Get export batch with progress
   */
  async getBatch(batchId: string): Promise<ExportBatch | null> {
    return this.exportBatchModel.getById(batchId);
  }

  /**
   * Get export batches for a project
   */
  async getBatchesForProject(projectId: string): Promise<ExportBatch[]> {
    return this.exportBatchModel.getByProjectId(projectId);
  }

  /**
   * Get batch items with details
   */
  async getBatchItems(batchId: string): Promise<ExportBatchItem[]> {
    return this.exportBatchModel.getBatchItems(batchId);
  }

  /**
   * Cancel an export batch
   */
  async cancelBatch(batchId: string): Promise<void> {
    const batch = await this.exportBatchModel.getById(batchId);
    if (!batch) {
      throw new Error('Export batch not found');
    }

    if (batch.status === 'completed' || batch.status === 'failed') {
      throw new Error('Cannot cancel completed or failed batch');
    }

    await this.exportBatchModel.updateStatus(batchId, 'failed', {
      error_message: 'Cancelled by user',
      completed_at: new Date()
    });
>>>>>>> check-fury-w8a
  }
}