import { Pool, QueryResult } from 'pg';
import { ExportBatch, ExportBatchItem, CreateExportBatchRequest } from './types';

export class ExportBatchModel {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Create a new export batch
   */
  async create(data: CreateExportBatchRequest): Promise<ExportBatch> {
    const query = `
      INSERT INTO export_batches (
        project_id, type, target_service, target_config,
        max_retries, retry_delay_seconds, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING *
    `;

    const values = [
      data.project_id,
      data.type,
      data.target_service,
      JSON.stringify(data.target_config),
      data.max_retries ?? 3,
      data.retry_delay_seconds ?? 30
    ];

    const result: QueryResult = await this.db.query(query, values);
    return this.mapDbRowToBatch(result.rows[0]);
  }

  /**
   * Get export batch by ID
   */
  async getById(id: string): Promise<ExportBatch | null> {
    const query = 'SELECT * FROM export_batches WHERE id = $1';
    const result: QueryResult = await this.db.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapDbRowToBatch(result.rows[0]);
  }

  /**
   * Get all export batches for a project
   */
  async getByProjectId(projectId: string): Promise<ExportBatch[]> {
    const query = `
      SELECT * FROM export_batches
      WHERE project_id = $1
      ORDER BY created_at DESC
    `;
    const result: QueryResult = await this.db.query(query, [projectId]);

    return result.rows.map(row => this.mapDbRowToBatch(row));
  }

  /**
   * Update export batch status and progress
   */
  async updateStatus(
    id: string,
    status: ExportBatch['status'],
    updates?: Partial<Pick<ExportBatch, 'total_items' | 'processed_items' | 'failed_items' | 'error_message' | 'started_at' | 'completed_at' | 'next_retry_at' | 'retry_count'>>
  ): Promise<ExportBatch> {
    let query = `
      UPDATE export_batches
      SET status = $2, updated_at = NOW()
    `;
    const values: any[] = [id, status];
    let paramIndex = 3;

    if (updates) {
      if (updates.total_items !== undefined) {
        query += `, total_items = $${paramIndex++}`;
        values.push(updates.total_items);
      }
      if (updates.processed_items !== undefined) {
        query += `, processed_items = $${paramIndex++}`;
        values.push(updates.processed_items);
      }
      if (updates.failed_items !== undefined) {
        query += `, failed_items = $${paramIndex++}`;
        values.push(updates.failed_items);
      }
      if (updates.error_message !== undefined) {
        query += `, error_message = $${paramIndex++}`;
        values.push(updates.error_message);
      }
      if (updates.started_at !== undefined) {
        query += `, started_at = $${paramIndex++}`;
        values.push(updates.started_at);
      }
      if (updates.completed_at !== undefined) {
        query += `, completed_at = $${paramIndex++}`;
        values.push(updates.completed_at);
      }
      if (updates.next_retry_at !== undefined) {
        query += `, next_retry_at = $${paramIndex++}`;
        values.push(updates.next_retry_at);
      }
      if (updates.retry_count !== undefined) {
        query += `, retry_count = $${paramIndex++}`;
        values.push(updates.retry_count);
      }
    }

    query += ' WHERE id = $1 RETURNING *';

    const result: QueryResult = await this.db.query(query, values);
    return this.mapDbRowToBatch(result.rows[0]);
  }

  /**
   * Get batches ready for retry
   */
  async getBatchesReadyForRetry(): Promise<ExportBatch[]> {
    const query = `
      SELECT * FROM export_batches
      WHERE status = 'retrying'
        AND next_retry_at IS NOT NULL
        AND next_retry_at <= NOW()
        AND retry_count < max_retries
      ORDER BY next_retry_at ASC
    `;
    const result: QueryResult = await this.db.query(query);

    return result.rows.map(row => this.mapDbRowToBatch(row));
  }

  /**
   * Delete export batch and all its items
   */
  async delete(id: string): Promise<void> {
    const query = 'DELETE FROM export_batches WHERE id = $1';
    await this.db.query(query, [id]);
  }

  /**
   * Create batch items for a batch
   */
  async createBatchItems(batchId: string, items: { source_type: string; source_id: string }[]): Promise<ExportBatchItem[]> {
    if (items.length === 0) return [];

    const values: string[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    items.forEach((item, index) => {
      placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, 'pending', 0, '{}', NOW(), NOW())`);
      values.push(batchId, item.source_type, item.source_id);
    });

    const query = `
      INSERT INTO export_batch_items (
        batch_id, source_type, source_id, status, retry_count, export_data, created_at, updated_at
      )
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    const result: QueryResult = await this.db.query(query, values);
    return result.rows.map(row => this.mapDbRowToBatchItem(row));
  }

  /**
   * Get batch items for a batch
   */
  async getBatchItems(batchId: string): Promise<ExportBatchItem[]> {
    const query = `
      SELECT * FROM export_batch_items
      WHERE batch_id = $1
      ORDER BY created_at ASC
    `;
    const result: QueryResult = await this.db.query(query, [batchId]);

    return result.rows.map(row => this.mapDbRowToBatchItem(row));
  }

  /**
   * Update batch item status
   */
  async updateBatchItem(
    id: string,
    updates: Partial<Pick<ExportBatchItem, 'status' | 'external_id' | 'external_url' | 'export_data' | 'error_message' | 'retry_count' | 'started_at' | 'completed_at'>>
  ): Promise<ExportBatchItem> {
    let query = `
      UPDATE export_batch_items
      SET updated_at = NOW()
    `;
    const values: any[] = [id];
    let paramIndex = 2;

    if (updates.status !== undefined) {
      query += `, status = $${paramIndex++}`;
      values.push(updates.status);
    }
    if (updates.external_id !== undefined) {
      query += `, external_id = $${paramIndex++}`;
      values.push(updates.external_id);
    }
    if (updates.external_url !== undefined) {
      query += `, external_url = $${paramIndex++}`;
      values.push(updates.external_url);
    }
    if (updates.export_data !== undefined) {
      query += `, export_data = $${paramIndex++}`;
      values.push(JSON.stringify(updates.export_data));
    }
    if (updates.error_message !== undefined) {
      query += `, error_message = $${paramIndex++}`;
      values.push(updates.error_message);
    }
    if (updates.retry_count !== undefined) {
      query += `, retry_count = $${paramIndex++}`;
      values.push(updates.retry_count);
    }
    if (updates.started_at !== undefined) {
      query += `, started_at = $${paramIndex++}`;
      values.push(updates.started_at);
    }
    if (updates.completed_at !== undefined) {
      query += `, completed_at = $${paramIndex++}`;
      values.push(updates.completed_at);
    }

    query += ' WHERE id = $1 RETURNING *';

    const result: QueryResult = await this.db.query(query, values);
    return this.mapDbRowToBatchItem(result.rows[0]);
  }

  /**
   * Map database row to ExportBatch object
   */
  private mapDbRowToBatch(row: any): ExportBatch {
    return {
      id: row.id,
      project_id: row.project_id,
      type: row.type,
      status: row.status,
      target_service: row.target_service,
      target_config: row.target_config || {},
      total_items: row.total_items || 0,
      processed_items: row.processed_items || 0,
      failed_items: row.failed_items || 0,
      max_retries: row.max_retries || 3,
      retry_count: row.retry_count || 0,
      retry_delay_seconds: row.retry_delay_seconds || 30,
      results: row.results || {},
      error_message: row.error_message,
      started_at: row.started_at,
      completed_at: row.completed_at,
      next_retry_at: row.next_retry_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * Map database row to ExportBatchItem object
   */
  private mapDbRowToBatchItem(row: any): ExportBatchItem {
    return {
      id: row.id,
      batch_id: row.batch_id,
      source_type: row.source_type,
      source_id: row.source_id,
      status: row.status,
      retry_count: row.retry_count || 0,
      external_id: row.external_id,
      external_url: row.external_url,
      export_data: row.export_data || {},
      error_message: row.error_message,
      started_at: row.started_at,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}