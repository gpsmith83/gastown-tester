import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { Subscription } from 'rxjs';
import { ExportService, ExportJobWithDetails } from '../services/export.service';

@Component({
  selector: 'app-export-status',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatMenuModule
  ],
  template: `
    <mat-card class="export-status-card">
      <mat-card-header>
        <div mat-card-avatar [ngClass]="'avatar-' + exportService.getStatusColor(exportJob.status)">
          <mat-icon *ngIf="exportJob.status === 'completed'">check_circle</mat-icon>
          <mat-icon *ngIf="exportJob.status === 'failed'">error</mat-icon>
          <mat-icon *ngIf="exportJob.status === 'cancelled'">cancel</mat-icon>
          <mat-spinner *ngIf="exportJob.status === 'processing'" diameter="24"></mat-spinner>
          <mat-icon *ngIf="exportJob.status === 'pending'">schedule</mat-icon>
        </div>
        <mat-card-title>{{exportJob.name}}</mat-card-title>
        <mat-card-subtitle>
          <div class="export-meta">
            <span>{{exportService.formatExportType(exportJob.export_type)}} • {{exportJob.format.toUpperCase()}}</span>
            <mat-chip [ngClass]="'status-chip-' + exportService.getStatusColor(exportJob.status)">
              {{exportService.formatExportStatus(exportJob.status)}}
            </mat-chip>
          </div>
        </mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        <!-- Description -->
        <p *ngIf="exportJob.description" class="export-description">
          {{exportJob.description}}
        </p>

        <!-- Progress Bar -->
        <div *ngIf="exportJob.status === 'processing'" class="progress-section">
          <div class="progress-label">
            <span>Progress: {{exportJob.progress_percentage}}%</span>
            <span *ngIf="exportJob.exported_records && exportJob.total_records">
              ({{exportJob.exported_records}} / {{exportJob.total_records}} records)
            </span>
          </div>
          <mat-progress-bar mode="determinate" [value]="exportJob.progress_percentage"></mat-progress-bar>
        </div>

        <!-- Export Details -->
        <div class="export-details">
          <div class="detail-row" *ngIf="exportJob.workspace">
            <mat-icon class="detail-icon">business</mat-icon>
            <span><strong>Workspace:</strong> {{exportJob.workspace.name}}</span>
          </div>
          <div class="detail-row" *ngIf="exportJob.project">
            <mat-icon class="detail-icon">folder</mat-icon>
            <span><strong>Project:</strong> {{exportJob.project.name}}</span>
          </div>
          <div class="detail-row" *ngIf="exportJob.file_size_bytes">
            <mat-icon class="detail-icon">storage</mat-icon>
            <span><strong>Size:</strong> {{exportService.formatFileSize(exportJob.file_size_bytes)}}</span>
          </div>
          <div class="detail-row">
            <mat-icon class="detail-icon">schedule</mat-icon>
            <span><strong>Created:</strong> {{formatDate(exportJob.created_at)}}</span>
          </div>
          <div class="detail-row" *ngIf="exportJob.completed_at">
            <mat-icon class="detail-icon">done</mat-icon>
            <span><strong>Completed:</strong> {{formatDate(exportJob.completed_at)}}</span>
          </div>
          <div class="detail-row" *ngIf="exportJob.expires_at">
            <mat-icon class="detail-icon">event</mat-icon>
            <span><strong>Expires:</strong> {{formatDate(exportJob.expires_at)}}</span>
          </div>
        </div>

        <!-- Error Message -->
        <div *ngIf="exportJob.status === 'failed'" class="error-section">
          <mat-icon class="error-icon">error_outline</mat-icon>
          <div>
            <strong>Export Failed</strong>
            <p *ngIf="exportJob.error_message" class="error-message">{{exportJob.error_message}}</p>
          </div>
        </div>

        <!-- Confirmation Status -->
        <div *ngIf="exportJob.confirmation && exportJob.status === 'completed'" class="confirmation-section">
          <mat-icon class="confirmation-icon">verified</mat-icon>
          <div>
            <strong>Export Confirmed</strong>
            <p *ngIf="exportJob.confirmation.confirmation_message">{{exportJob.confirmation.confirmation_message}}</p>
            <div class="confirmation-meta">
              <span *ngIf="exportJob.confirmation.satisfaction_rating" class="rating">
                Rating: {{exportJob.confirmation.satisfaction_rating}}/5
                <mat-icon class="star-icon">star</mat-icon>
              </span>
              <span class="download-count">
                Downloads: {{exportJob.confirmation.download_count}}
              </span>
            </div>
          </div>
        </div>
      </mat-card-content>

      <mat-card-actions align="end">
        <!-- Refresh Button -->
        <button
          mat-button
          (click)="onRefresh()"
          [disabled]="isRefreshing"
          matTooltip="Refresh status">
          <mat-icon>refresh</mat-icon>
          Refresh
        </button>

        <!-- Cancel Button -->
        <button
          *ngIf="canCancel()"
          mat-button
          color="warn"
          (click)="onCancel()"
          [disabled]="isCancelling">
          <mat-icon>cancel</mat-icon>
          Cancel
        </button>

        <!-- Download Button -->
        <button
          *ngIf="canDownload()"
          mat-raised-button
          color="primary"
          (click)="onDownload()"
          [disabled]="isDownloading">
          <mat-icon>download</mat-icon>
          <span *ngIf="!isDownloading">Download</span>
          <span *ngIf="isDownloading">Downloading...</span>
        </button>

        <!-- Confirm Button -->
        <button
          *ngIf="canConfirm()"
          mat-raised-button
          color="accent"
          (click)="onConfirm()">
          <mat-icon>check_circle</mat-icon>
          Confirm
        </button>

        <!-- More Actions Menu -->
        <button mat-icon-button [matMenuTriggerFor]="actionsMenu" matTooltip="More actions">
          <mat-icon>more_vert</mat-icon>
        </button>
        <mat-menu #actionsMenu="matMenu">
          <button mat-menu-item (click)="onViewHistory()">
            <mat-icon>history</mat-icon>
            <span>View Activity</span>
          </button>
          <button mat-menu-item (click)="onCopyLink()" *ngIf="exportJob.status === 'completed'">
            <mat-icon>link</mat-icon>
            <span>Copy Download Link</span>
          </button>
        </mat-menu>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    .export-status-card {
      margin-bottom: 1rem;
      max-width: 600px;
    }

    .export-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .status-chip-green { background-color: #e8f5e8; color: #2e7d32; }
    .status-chip-blue { background-color: #e3f2fd; color: #1976d2; }
    .status-chip-orange { background-color: #fff3e0; color: #f57c00; }
    .status-chip-red { background-color: #ffebee; color: #d32f2f; }
    .status-chip-gray { background-color: #f5f5f5; color: #616161; }

    .avatar-green { background-color: #4caf50; color: white; }
    .avatar-blue { background-color: #2196f3; color: white; }
    .avatar-orange { background-color: #ff9800; color: white; }
    .avatar-red { background-color: #f44336; color: white; }
    .avatar-gray { background-color: #9e9e9e; color: white; }

    .export-description {
      color: #666;
      margin-bottom: 1rem;
    }

    .progress-section {
      margin: 1rem 0;
    }

    .progress-label {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
      font-size: 14px;
      color: #666;
    }

    .export-details {
      margin: 1rem 0;
    }

    .detail-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      font-size: 14px;
    }

    .detail-icon {
      color: #666;
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .error-section {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      background-color: #ffebee;
      border: 1px solid #ffcdd2;
      border-radius: 4px;
      padding: 1rem;
      margin: 1rem 0;
    }

    .error-icon {
      color: #d32f2f;
      margin-top: 2px;
    }

    .error-message {
      color: #d32f2f;
      margin: 0.5rem 0 0 0;
      font-size: 14px;
    }

    .confirmation-section {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      background-color: #e8f5e8;
      border: 1px solid #c8e6c9;
      border-radius: 4px;
      padding: 1rem;
      margin: 1rem 0;
    }

    .confirmation-icon {
      color: #2e7d32;
      margin-top: 2px;
    }

    .confirmation-meta {
      display: flex;
      gap: 1rem;
      margin-top: 0.5rem;
      font-size: 14px;
      color: #666;
    }

    .rating {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .star-icon {
      color: #ffc107;
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    mat-card-actions {
      padding: 16px;
    }
  `]
})
export class ExportStatusComponent implements OnInit, OnDestroy {
  @Input() exportJob!: ExportJobWithDetails;
  @Input() autoRefresh = true;

  private statusSubscription?: Subscription;
  isRefreshing = false;
  isCancelling = false;
  isDownloading = false;

  constructor(public exportService: ExportService) {}

  ngOnInit() {
    if (this.autoRefresh && this.isInProgress()) {
      this.startStatusPolling();
    }
  }

  ngOnDestroy() {
    this.stopStatusPolling();
  }

  private startStatusPolling() {
    this.stopStatusPolling();
    this.statusSubscription = this.exportService.pollExportStatus(this.exportJob.id)
      .subscribe({
        next: (exportJob) => {
          this.exportJob = exportJob;

          // Stop polling when export is no longer in progress
          if (!this.isInProgress()) {
            this.stopStatusPolling();
          }
        },
        error: (error) => {
          console.error('Status polling failed:', error);
          this.stopStatusPolling();
        }
      });
  }

  private stopStatusPolling() {
    if (this.statusSubscription) {
      this.statusSubscription.unsubscribe();
      this.statusSubscription = undefined;
    }
  }

  isInProgress(): boolean {
    return ['pending', 'processing'].includes(this.exportJob.status);
  }

  canCancel(): boolean {
    return ['pending', 'processing'].includes(this.exportJob.status);
  }

  canDownload(): boolean {
    return this.exportJob.status === 'completed' && !!this.exportJob.file_path;
  }

  canConfirm(): boolean {
    return this.exportJob.status === 'completed' && !this.exportJob.confirmation;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  onRefresh() {
    this.isRefreshing = true;
    this.exportService.getExportJob(this.exportJob.id).subscribe({
      next: (response) => {
        this.exportJob = response.export_job;
        this.isRefreshing = false;

        // Restart polling if needed
        if (this.autoRefresh && this.isInProgress()) {
          this.startStatusPolling();
        }
      },
      error: (error) => {
        console.error('Refresh failed:', error);
        this.isRefreshing = false;
      }
    });
  }

  onCancel() {
    this.isCancelling = true;
    this.exportService.cancelExport(this.exportJob.id).subscribe({
      next: (response) => {
        this.exportJob = response.export_job;
        this.isCancelling = false;
        this.stopStatusPolling();
      },
      error: (error) => {
        console.error('Cancel failed:', error);
        this.isCancelling = false;
      }
    });
  }

  onDownload() {
    this.isDownloading = true;
    try {
      this.exportService.downloadAndSaveFile(this.exportJob);

      // Track the download (after a short delay to allow download to start)
      setTimeout(() => {
        this.onRefresh(); // Refresh to update download count
      }, 1000);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      this.isDownloading = false;
    }
  }

  onConfirm() {
    // This would open a confirmation dialog
    // For now, just confirm with default values
    this.exportService.confirmExport(this.exportJob.id, {}).subscribe({
      next: (response) => {
        // Update the export job with confirmation
        this.exportJob.confirmation = response.confirmation;
      },
      error: (error) => {
        console.error('Confirmation failed:', error);
      }
    });
  }

  onViewHistory() {
    // TODO: Open activity/history dialog
    console.log('View history for export:', this.exportJob.id);
  }

  onCopyLink() {
    // Copy download link to clipboard
    const link = `${this.exportService['apiUrl']}/${this.exportJob.id}/download`;
    navigator.clipboard.writeText(link).then(() => {
      console.log('Download link copied to clipboard');
      // TODO: Show toast notification
    }).catch(error => {
      console.error('Failed to copy link:', error);
    });
  }
}