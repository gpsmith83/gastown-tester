import { db } from '../config/database';
import {
  ExportBatch,
  ExportBatchItem,
  CreateExportBatchRequest,
  ExportBatchWithItems,
  ExportBatchSummary
} from './types';

export class ExportBatchModel {

  // Helper method for safe JSON parsing
  private static safeJsonParse(json: string, fallback: any = {}): any {
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
  }

  // Create a new export batch
  static async create(
    data: CreateExportBatchRequest,
    created_by: string,
    project_id: string
  ): Promise<ExportBatch> {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Create the export batch
      const batchResult = await client.query(
        `INSERT INTO export_batches (
          project_id, name, description, target_type, target_config,
          total_items, created_by, retry_failed, max_retries
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          project_id,
          data.name,
          data.description || null,
          data.target_type,
          JSON.stringify(data.target_config),
          data.requirement_ids.length,
          created_by,
          data.retry_failed ?? true,
          data.max_retries ?? 3
        ]
      );

      const batch = batchResult.rows[0];

      // Create batch items for each requirement
      for (const requirementId of data.requirement_ids) {
        await client.query(
          `INSERT INTO export_batch_items (batch_id, requirement_id)
           VALUES ($1, $2)`,
          [batch.id, requirementId]
        );
      }

      await client.query('COMMIT');
      return batch;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get export batch by ID with items
  static async findByIdWithItems(batchId: string): Promise<ExportBatchWithItems | null> {
    const batchResult = await db.query(
      'SELECT * FROM export_batches WHERE id = $1',
      [batchId]
    );

    if (batchResult.rows.length === 0) {
      return null;
    }

    const batch = batchResult.rows[0];

    // Parse target_config JSON
    if (batch.target_config) {
      batch.target_config = this.safeJsonParse(batch.target_config);
    }

    const itemsResult = await db.query(
      `SELECT ebi.*, r.title as requirement_title, r.description as requirement_description
       FROM export_batch_items ebi
       JOIN requirements r ON r.id = ebi.requirement_id
       WHERE ebi.batch_id = $1
       ORDER BY ebi.created_at`,
      [batchId]
    );

    return {
      ...batch,
      items: itemsResult.rows
    };
  }

  // Get export batch by ID
  static async findById(batchId: string): Promise<ExportBatch | null> {
    const result = await db.query(
      'SELECT * FROM export_batches WHERE id = $1',
      [batchId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const batch = result.rows[0];

    // Parse target_config JSON
    if (batch.target_config) {
      batch.target_config = this.safeJsonParse(batch.target_config);
    }

    return batch;
  }

  // Get all export batches for a project
  static async findByProjectId(projectId: string): Promise<ExportBatchSummary[]> {
    const result = await db.query(
      `SELECT id, name, status, total_items, processed_items, failed_items,
              created_at, started_at, completed_at
       FROM export_batches
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId]
    );

    return result.rows;
  }

  // Update batch status and progress
  static async updateStatus(
    batchId: string,
    status: string,
    processed_items?: number,
    failed_items?: number,
    error_message?: string
  ): Promise<ExportBatch | null> {
    const fields = ['status = $2'];
    const values: any[] = [batchId, status];
    let paramIndex = 3;

    if (processed_items !== undefined) {
      fields.push(`processed_items = $${paramIndex++}`);
      values.push(processed_items);
    }

    if (failed_items !== undefined) {
      fields.push(`failed_items = $${paramIndex++}`);
      values.push(failed_items);
    }

    if (error_message !== undefined) {
      fields.push(`error_message = $${paramIndex++}`);
      values.push(error_message);
    }

    // Set started_at if moving to in_progress
    if (status === 'in_progress') {
      fields.push(`started_at = NOW()`);
    }

    // Set completed_at if moving to completed/failed/partially_completed
    if (['completed', 'failed', 'partially_completed'].includes(status)) {
      fields.push(`completed_at = NOW()`);
    }

    const result = await db.query(
      `UPDATE export_batches
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      values
    );

    const batch = result.rows[0] || null;
    if (batch && batch.target_config) {
      batch.target_config = this.safeJsonParse(batch.target_config);
    }

    return batch;
  }

  // Update batch item status
  static async updateItemStatus(
    itemId: string,
    status: string,
    external_id?: string,
    external_url?: string,
    error_message?: string
  ): Promise<ExportBatchItem | null> {
    const fields = ['status = $2'];
    const values = [itemId, status];
    let paramIndex = 3;

    if (external_id !== undefined) {
      fields.push(`external_id = $${paramIndex++}`);
      values.push(external_id);
    }

    if (external_url !== undefined) {
      fields.push(`external_url = $${paramIndex++}`);
      values.push(external_url);
    }

    if (error_message !== undefined) {
      fields.push(`error_message = $${paramIndex++}`);
      values.push(error_message);
    }

    if (status === 'in_progress') {
      fields.push(`last_attempted_at = NOW()`);
    }

    if (status === 'completed') {
      fields.push(`completed_at = NOW()`);
    }

    if (status === 'failed') {
      fields.push(`retry_count = retry_count + 1`);
      fields.push(`last_attempted_at = NOW()`);
    }

    const result = await db.query(
      `UPDATE export_batch_items
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Get pending batches for processing
  static async findPending(): Promise<ExportBatch[]> {
    const result = await db.query(
      `SELECT * FROM export_batches
       WHERE status = 'pending'
       ORDER BY created_at ASC`
    );

    return result.rows.map(batch => {
      if (batch.target_config) {
        batch.target_config = this.safeJsonParse(batch.target_config);
      }
      return batch;
    });
  }

  // Get failed items that can be retried
  static async findRetryableItems(batchId: string): Promise<ExportBatchItem[]> {
    const result = await db.query(
      `SELECT ebi.*, eb.max_retries
       FROM export_batch_items ebi
       JOIN export_batches eb ON eb.id = ebi.batch_id
       WHERE ebi.batch_id = $1
       AND ebi.status = 'failed'
       AND ebi.retry_count < eb.max_retries
       AND eb.retry_failed = true
       ORDER BY ebi.last_attempted_at ASC`,
      [batchId]
    );

    return result.rows;
  }

  // Delete export batch and its items
  static async delete(batchId: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM export_batches WHERE id = $1',
      [batchId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Get batch statistics
  static async getStats(batchId: string): Promise<{
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    failed: number;
  }> {
    const result = await db.query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'pending') as pending,
         COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
         COUNT(*) FILTER (WHERE status = 'completed') as completed,
         COUNT(*) FILTER (WHERE status = 'failed') as failed
       FROM export_batch_items
       WHERE batch_id = $1`,
      [batchId]
    );

    return result.rows[0] || { total: 0, pending: 0, in_progress: 0, completed: 0, failed: 0 };
  }
}