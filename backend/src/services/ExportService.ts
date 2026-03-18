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
  }
}