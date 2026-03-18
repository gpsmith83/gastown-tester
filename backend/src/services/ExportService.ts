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

    // We need to get the API token from somewhere secure
    // For now, we'll require it to be passed in the target_config
    const apiToken = batch.target_config.api_token;
    if (!apiToken) {
      throw new Error('Linear API token not provided in batch configuration');
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
        batch.target_config = JSON.parse(batch.target_config);
      }
      return batch;
    });

    return { batches, total };
  }
}