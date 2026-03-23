import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, interval, switchMap, takeUntil, takeWhile, map } from 'rxjs';

export interface CreateExportRequest {
  name: string;
  description?: string;
  export_type: 'requirements' | 'projects' | 'workspace';
  format?: 'csv' | 'json' | 'xlsx';
  workspace_id?: string;
  project_id?: string;
  filters?: Record<string, any>;
  columns?: string[];
  options?: Record<string, any>;
}

export interface ExportJob {
  id: string;
  name: string;
  description?: string;
  export_type: 'requirements' | 'projects' | 'workspace';
  format: 'csv' | 'json' | 'xlsx';
  user_id: string;
  workspace_id?: string;
  project_id?: string;
  filters?: Record<string, any>;
  columns?: string[];
  options?: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress_percentage: number;
  file_path?: string;
  file_size_bytes?: number;
  total_records?: number;
  exported_records?: number;
  error_message?: string;
  error_details?: Record<string, any>;
  started_at?: string;
  completed_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ExportJobWithDetails extends ExportJob {
  user?: any;
  workspace?: any;
  project?: any;
  confirmation?: ExportConfirmation;
  notifications?: ExportNotification[];
}

export interface ExportConfirmation {
  id: string;
  export_job_id: string;
  confirmed_by: string;
  confirmation_message?: string;
  satisfaction_rating?: number;
  feedback_comment?: string;
  download_count: number;
  last_downloaded_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ExportNotification {
  id: string;
  export_job_id: string;
  recipient_id: string;
  notification_type: 'completed' | 'failed' | 'reminder';
  title: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at?: string;
  read_at?: string;
  channels: string[];
  created_at: string;
  updated_at: string;
}

export interface ExportConfirmationRequest {
  confirmation_message?: string;
  satisfaction_rating?: number;
  feedback_comment?: string;
}

export interface ExportHistoryResponse {
  exports: ExportJobWithDetails[];
  total: number;
  page: number;
  per_page: number;
}

export interface ExportStatsResponse {
  total_exports: number;
  completed_exports: number;
  failed_exports: number;
  total_size_mb: number;
  avg_satisfaction_rating?: number;
  most_popular_format: string;
  most_popular_type: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  private readonly API_BASE = 'http://localhost:3000';
  private apiUrl = `${this.API_BASE}/api/exports`;

  constructor(private http: HttpClient) {}

  /**
   * Create a new export job
   */
  createExport(request: CreateExportRequest): Observable<{ export_job: ExportJob; message: string }> {
    return this.http.post<{ export_job: ExportJob; message: string }>(
      this.apiUrl,
      request,
      { withCredentials: true }
    );
  }

  /**
   * Get export job details
   */
  getExportJob(exportId: string): Observable<{ export_job: ExportJobWithDetails }> {
    return this.http.get<{ export_job: ExportJobWithDetails }>(
      `${this.apiUrl}/${exportId}`,
      { withCredentials: true }
    );
  }

  /**
   * Get export history with pagination
   */
  getExportHistory(
    page: number = 1,
    per_page: number = 20,
    workspace_id?: string,
    project_id?: string
  ): Observable<ExportHistoryResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', per_page.toString());

    if (workspace_id) {
      params = params.set('workspace_id', workspace_id);
    }

    if (project_id) {
      params = params.set('project_id', project_id);
    }

    return this.http.get<ExportHistoryResponse>(
      this.apiUrl,
      { params, withCredentials: true }
    );
  }

  /**
   * Confirm export completion with feedback
   */
  confirmExport(
    exportId: string,
    confirmation: ExportConfirmationRequest
  ): Observable<{ confirmation: ExportConfirmation; message: string }> {
    return this.http.post<{ confirmation: ExportConfirmation; message: string }>(
      `${this.apiUrl}/${exportId}/confirm`,
      confirmation,
      { withCredentials: true }
    );
  }

  /**
   * Download export file
   */
  downloadExport(exportId: string): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/${exportId}/download`,
      {
        responseType: 'blob',
        withCredentials: true
      }
    );
  }

  /**
   * Cancel export job
   */
  cancelExport(exportId: string): Observable<{ export_job: ExportJob; message: string }> {
    return this.http.post<{ export_job: ExportJob; message: string }>(
      `${this.apiUrl}/${exportId}/cancel`,
      {},
      { withCredentials: true }
    );
  }

  /**
   * Get export statistics
   */
  getExportStats(workspace_id?: string): Observable<ExportStatsResponse> {
    let params = new HttpParams();
    if (workspace_id) {
      params = params.set('workspace_id', workspace_id);
    }

    return this.http.get<ExportStatsResponse>(
      `${this.apiUrl}/stats/summary`,
      { params, withCredentials: true }
    );
  }

  /**
   * Mark notification as read
   */
  markNotificationRead(notificationId: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      `${this.apiUrl}/notifications/${notificationId}/read`,
      {},
      { withCredentials: true }
    );
  }

  /**
   * Poll export job status until completion
   */
  pollExportStatus(exportId: string, intervalMs: number = 2000): Observable<ExportJobWithDetails> {
    return interval(intervalMs).pipe(
      switchMap(() => this.getExportJob(exportId)),
      takeWhile((response) => {
        const status = response.export_job.status;
        return status === 'pending' || status === 'processing';
      }, true), // Include the final emission when condition becomes false
      map(response => response.export_job)
    );
  }

  /**
   * Start export and return observable that tracks progress
   */
  startExportWithProgress(request: CreateExportRequest): Observable<ExportJobWithDetails> {
    return this.createExport(request).pipe(
      switchMap((createResponse) => {
        return this.pollExportStatus(createResponse.export_job.id);
      })
    );
  }

  /**
   * Download export file and trigger browser download
   */
  downloadAndSaveFile(exportJob: ExportJobWithDetails): void {
    this.downloadExport(exportJob.id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        // Determine filename from export job
        const extension = exportJob.format;
        const timestamp = new Date(exportJob.created_at).toISOString().slice(0, 10);
        const filename = `${exportJob.name}_${timestamp}.${extension}`;

        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Download failed:', error);
        throw error;
      }
    });
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes?: number): string {
    if (!bytes) return '0 B';

    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * Format export type for display
   */
  formatExportType(type: string): string {
    switch (type) {
      case 'requirements': return 'Requirements';
      case 'projects': return 'Projects';
      case 'workspace': return 'Workspace';
      default: return type;
    }
  }

  /**
   * Format export status for display
   */
  formatExportStatus(status: string): string {
    switch (status) {
      case 'pending': return 'Pending';
      case 'processing': return 'Processing';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  }

  /**
   * Get status color for UI display
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'orange';
      case 'processing': return 'blue';
      case 'completed': return 'green';
      case 'failed': return 'red';
      case 'cancelled': return 'gray';
      default: return 'gray';
    }
  }
}