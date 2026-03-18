import { db } from '../config/database';
import {
  ExportJob,
  ExportJobWithDetails,
  ExportConfirmation,
  ExportNotification,
  ExportActivityLog,
  CreateExportRequest,
  ExportConfirmationRequest,
  ExportHistoryResponse,
  ExportStatsResponse,
  User
} from './types';

export class ExportJobModel {
  // Create a new export job
  static async create(data: CreateExportRequest, user_id: string): Promise<ExportJob> {
    const result = await db.query(
      `INSERT INTO export_jobs (
        name, description, export_type, format, user_id,
        workspace_id, project_id, filters, columns, options,
        expires_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        data.name,
        data.description,
        data.export_type,
        data.format || 'csv',
        user_id,
        data.workspace_id,
        data.project_id,
        JSON.stringify(data.filters || {}),
        JSON.stringify(data.columns || []),
        JSON.stringify(data.options || {}),
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expires in 7 days
      ]
    );

    const exportJob = result.rows[0];

    // Log creation activity
    await this.logActivity(exportJob.id, 'created', 'Export job created', user_id);

    return exportJob;
  }

  // Get export job by ID
  static async findById(id: string): Promise<ExportJob | null> {
    const result = await db.query(
      'SELECT * FROM export_jobs WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get export job with full details
  static async findByIdWithDetails(id: string): Promise<ExportJobWithDetails | null> {
    const result = await db.query(
      `SELECT ej.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user,
              JSON_BUILD_OBJECT(
                'id', w.id,
                'name', w.name,
                'description', w.description
              ) as workspace,
              JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name,
                'description', p.description
              ) as project
       FROM export_jobs ej
       INNER JOIN users u ON ej.user_id = u.id
       LEFT JOIN workspaces w ON ej.workspace_id = w.id
       LEFT JOIN projects p ON ej.project_id = p.id
       WHERE ej.id = $1`,
      [id]
    );

    if (!result.rows[0]) {
      return null;
    }

    const exportJob = result.rows[0];

    // Get confirmation if exists
    const confirmation = await this.getConfirmation(id);
    if (confirmation) {
      exportJob.confirmation = confirmation;
    }

    // Get notifications
    const notifications = await this.getNotifications(id);
    exportJob.notifications = notifications;

    return exportJob;
  }

  // Get export history for a user
  static async findByUserId(
    user_id: string,
    page: number = 1,
    per_page: number = 20
  ): Promise<ExportHistoryResponse> {
    const offset = (page - 1) * per_page;

    const countResult = await db.query(
      'SELECT COUNT(*) FROM export_jobs WHERE user_id = $1',
      [user_id]
    );

    const result = await db.query(
      `SELECT ej.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user,
              JSON_BUILD_OBJECT(
                'id', w.id,
                'name', w.name,
                'description', w.description
              ) as workspace,
              JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name,
                'description', p.description
              ) as project
       FROM export_jobs ej
       INNER JOIN users u ON ej.user_id = u.id
       LEFT JOIN workspaces w ON ej.workspace_id = w.id
       LEFT JOIN projects p ON ej.project_id = p.id
       WHERE ej.user_id = $1
       ORDER BY ej.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user_id, per_page, offset]
    );

    return {
      exports: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      per_page
    };
  }

  // Get export history for a workspace/project
  static async findByScope(
    user_id: string,
    workspace_id?: string,
    project_id?: string,
    page: number = 1,
    per_page: number = 20
  ): Promise<ExportHistoryResponse> {
    const offset = (page - 1) * per_page;
    let whereClause = 'WHERE ej.user_id = $1';
    const params: any[] = [user_id];
    let paramIndex = 2;

    if (workspace_id) {
      whereClause += ` AND ej.workspace_id = $${paramIndex++}`;
      params.push(workspace_id);
    }

    if (project_id) {
      whereClause += ` AND ej.project_id = $${paramIndex++}`;
      params.push(project_id);
    }

    const countResult = await db.query(
      `SELECT COUNT(*) FROM export_jobs ej ${whereClause}`,
      params
    );

    const result = await db.query(
      `SELECT ej.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user,
              JSON_BUILD_OBJECT(
                'id', w.id,
                'name', w.name,
                'description', w.description
              ) as workspace,
              JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name,
                'description', p.description
              ) as project
       FROM export_jobs ej
       INNER JOIN users u ON ej.user_id = u.id
       LEFT JOIN workspaces w ON ej.workspace_id = w.id
       LEFT JOIN projects p ON ej.project_id = p.id
       ${whereClause}
       ORDER BY ej.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, per_page, offset]
    );

    return {
      exports: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      per_page
    };
  }

  // Update export job status and progress
  static async updateStatus(
    id: string,
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',
    progress_percentage?: number,
    error_message?: string,
    file_path?: string,
    file_size_bytes?: number,
    exported_records?: number
  ): Promise<ExportJob | null> {
    const fields = ['status = $2'];
    const values = [id, status];
    let paramIndex = 3;

    if (progress_percentage !== undefined) {
      fields.push(`progress_percentage = $${paramIndex++}`);
      values.push(progress_percentage);
    }

    if (error_message !== undefined) {
      fields.push(`error_message = $${paramIndex++}`);
      values.push(error_message);
    }

    if (file_path !== undefined) {
      fields.push(`file_path = $${paramIndex++}`);
      values.push(file_path);
    }

    if (file_size_bytes !== undefined) {
      fields.push(`file_size_bytes = $${paramIndex++}`);
      values.push(file_size_bytes);
    }

    if (exported_records !== undefined) {
      fields.push(`exported_records = $${paramIndex++}`);
      values.push(exported_records);
    }

    // Set timestamps based on status
    if (status === 'processing') {
      fields.push(`started_at = NOW()`);
    } else if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      fields.push(`completed_at = NOW()`);
    }

    const result = await db.query(
      `UPDATE export_jobs SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      values
    );

    const exportJob = result.rows[0] || null;

    if (exportJob) {
      // Log status change activity
      await this.logActivity(id, status === 'processing' ? 'started' : status,
        `Export job status changed to ${status}`, exportJob.user_id);

      // Create notification for completion/failure
      if (status === 'completed' || status === 'failed') {
        await this.createNotification(
          id,
          exportJob.user_id,
          status,
          status === 'completed' ? 'Export completed successfully' : 'Export failed',
          status === 'completed'
            ? `Your export "${exportJob.name}" is ready for download.`
            : `Your export "${exportJob.name}" failed: ${error_message || 'Unknown error'}`
        );
      }
    }

    return exportJob;
  }

  // Create export confirmation
  static async createConfirmation(
    export_job_id: string,
    confirmed_by: string,
    data: ExportConfirmationRequest
  ): Promise<ExportConfirmation> {
    const result = await db.query(
      `INSERT INTO export_confirmations (
        export_job_id, confirmed_by, confirmation_message,
        satisfaction_rating, feedback_comment
      )
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (export_job_id, confirmed_by)
       DO UPDATE SET
         confirmation_message = EXCLUDED.confirmation_message,
         satisfaction_rating = EXCLUDED.satisfaction_rating,
         feedback_comment = EXCLUDED.feedback_comment,
         updated_at = NOW()
       RETURNING *`,
      [
        export_job_id,
        confirmed_by,
        data.confirmation_message,
        data.satisfaction_rating,
        data.feedback_comment
      ]
    );

    const confirmation = result.rows[0];

    // Log confirmation activity
    await this.logActivity(export_job_id, 'completed', 'Export confirmed by user', confirmed_by);

    return confirmation;
  }

  // Get export confirmation
  static async getConfirmation(export_job_id: string): Promise<ExportConfirmation | null> {
    const result = await db.query(
      'SELECT * FROM export_confirmations WHERE export_job_id = $1',
      [export_job_id]
    );

    return result.rows[0] || null;
  }

  // Track download
  static async trackDownload(export_job_id: string, user_id: string): Promise<boolean> {
    // Update download count and timestamp
    const result = await db.query(
      `UPDATE export_confirmations SET
         download_count = download_count + 1,
         last_downloaded_at = NOW(),
         updated_at = NOW()
       WHERE export_job_id = $1 AND confirmed_by = $2`,
      [export_job_id, user_id]
    );

    // Log download activity
    await this.logActivity(export_job_id, 'downloaded', 'Export file downloaded', user_id);

    return (result.rowCount ?? 0) > 0;
  }

  // Create notification
  static async createNotification(
    export_job_id: string,
    recipient_id: string,
    type: 'completed' | 'failed' | 'reminder',
    title: string,
    message: string
  ): Promise<ExportNotification> {
    const result = await db.query(
      `INSERT INTO export_notifications (
        export_job_id, recipient_id, notification_type, title, message
      )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [export_job_id, recipient_id, type, title, message]
    );

    return result.rows[0];
  }

  // Get notifications for export job
  static async getNotifications(export_job_id: string): Promise<ExportNotification[]> {
    const result = await db.query(
      `SELECT * FROM export_notifications
       WHERE export_job_id = $1
       ORDER BY created_at DESC`,
      [export_job_id]
    );

    return result.rows;
  }

  // Mark notification as read
  static async markNotificationRead(notification_id: string): Promise<boolean> {
    const result = await db.query(
      `UPDATE export_notifications SET
         read_at = NOW(),
         updated_at = NOW()
       WHERE id = $1 AND read_at IS NULL`,
      [notification_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Log activity
  static async logActivity(
    export_job_id: string,
    activity_type: string,
    description?: string,
    user_id?: string,
    details?: Record<string, any>
  ): Promise<ExportActivityLog> {
    const result = await db.query(
      `INSERT INTO export_activity_log (
        export_job_id, activity_type, description, user_id, details
      )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [export_job_id, activity_type, description, user_id, JSON.stringify(details || {})]
    );

    return result.rows[0];
  }

  // Get export statistics
  static async getStats(user_id: string, workspace_id?: string): Promise<ExportStatsResponse> {
    let whereClause = 'WHERE ej.user_id = $1';
    const params: any[] = [user_id];

    if (workspace_id) {
      whereClause += ' AND ej.workspace_id = $2';
      params.push(workspace_id);
    }

    const result = await db.query(
      `SELECT
         COUNT(*) as total_exports,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_exports,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_exports,
         COALESCE(SUM(file_size_bytes) / 1048576.0, 0) as total_size_mb,
         AVG(ec.satisfaction_rating) as avg_satisfaction_rating,
         (
           SELECT format FROM export_jobs ej2
           WHERE ej2.user_id = ej.user_id ${workspace_id ? 'AND ej2.workspace_id = $2' : ''}
           GROUP BY format
           ORDER BY COUNT(*) DESC
           LIMIT 1
         ) as most_popular_format,
         (
           SELECT export_type FROM export_jobs ej3
           WHERE ej3.user_id = ej.user_id ${workspace_id ? 'AND ej3.workspace_id = $2' : ''}
           GROUP BY export_type
           ORDER BY COUNT(*) DESC
           LIMIT 1
         ) as most_popular_type
       FROM export_jobs ej
       LEFT JOIN export_confirmations ec ON ej.id = ec.export_job_id
       ${whereClause}`,
      params
    );

    const stats = result.rows[0];
    return {
      total_exports: parseInt(stats.total_exports),
      completed_exports: parseInt(stats.completed_exports),
      failed_exports: parseInt(stats.failed_exports),
      total_size_mb: parseFloat(stats.total_size_mb),
      avg_satisfaction_rating: stats.avg_satisfaction_rating ? parseFloat(stats.avg_satisfaction_rating) : undefined,
      most_popular_format: stats.most_popular_format || 'csv',
      most_popular_type: stats.most_popular_type || 'requirements'
    };
  }

  // Cleanup expired exports
  static async cleanupExpired(): Promise<number> {
    const result = await db.query(
      `DELETE FROM export_jobs
       WHERE expires_at < NOW() AND status != 'processing'`
    );

    return result.rowCount ?? 0;
  }

  // Check if user can access export job
  static async canUserAccess(export_job_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM export_jobs ej
       WHERE ej.id = $1 AND (
         ej.user_id = $2 OR
         EXISTS (
           SELECT 1 FROM workspace_members wm
           WHERE wm.workspace_id = ej.workspace_id AND wm.user_id = $2
         ) OR
         EXISTS (
           SELECT 1 FROM project_members pm
           WHERE pm.project_id = ej.project_id AND pm.user_id = $2
         )
       )`,
      [export_job_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }
}