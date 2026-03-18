import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ExportService, ExportJobWithDetails, ExportHistoryResponse } from '../services/export.service';
import { ExportStatusComponent } from './export-status.component';
import { ExportCreateDialogComponent } from './export-create-dialog.component';
import { WorkspaceService } from '../services/workspace.service';

@Component({
  selector: 'app-export-history',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    ExportStatusComponent
  ],
  template: `
    <div class="export-history-container">
      <!-- Header -->
      <div class="header-section">
        <h2>Export History</h2>
        <button mat-raised-button color="primary" (click)="onCreateExport()">
          <mat-icon>add</mat-icon>
          New Export
        </button>
      </div>

      <!-- Filters -->
      <mat-card class="filters-card">
        <mat-card-content>
          <form [formGroup]="filtersForm" class="filters-form">
            <mat-form-field appearance="fill">
              <mat-label>Workspace</mat-label>
              <mat-select formControlName="workspace_id">
                <mat-option value="">All Workspaces</mat-option>
                <mat-option *ngFor="let workspace of workspaces" [value]="workspace.id">
                  {{workspace.name}}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="fill">
              <mat-label>Export Type</mat-label>
              <mat-select formControlName="export_type">
                <mat-option value="">All Types</mat-option>
                <mat-option value="requirements">Requirements</mat-option>
                <mat-option value="projects">Projects</mat-option>
                <mat-option value="workspace">Workspace</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="fill">
              <mat-label>Status</mat-label>
              <mat-select formControlName="status">
                <mat-option value="">All Statuses</mat-option>
                <mat-option value="completed">Completed</mat-option>
                <mat-option value="processing">Processing</mat-option>
                <mat-option value="pending">Pending</mat-option>
                <mat-option value="failed">Failed</mat-option>
                <mat-option value="cancelled">Cancelled</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="fill">
              <mat-label>Search</mat-label>
              <input matInput formControlName="search" placeholder="Search exports...">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>

            <button mat-button type="button" (click)="onClearFilters()" class="clear-filters-btn">
              <mat-icon>clear</mat-icon>
              Clear
            </button>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Statistics -->
      <mat-card class="stats-card" *ngIf="stats">
        <mat-card-content>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">{{stats.total_exports}}</div>
              <div class="stat-label">Total Exports</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{stats.completed_exports}}</div>
              <div class="stat-label">Completed</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{stats.failed_exports}}</div>
              <div class="stat-label">Failed</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{stats.total_size_mb.toFixed(1)}} MB</div>
              <div class="stat-label">Total Size</div>
            </div>
            <div class="stat-item" *ngIf="stats.avg_satisfaction_rating">
              <div class="stat-value">
                {{stats.avg_satisfaction_rating.toFixed(1)}}
                <mat-icon class="star-icon">star</mat-icon>
              </div>
              <div class="stat-label">Avg Rating</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{stats.most_popular_format.toUpperCase()}}</div>
              <div class="stat-label">Popular Format</div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Loading -->
      <div *ngIf="isLoading" class="loading-section">
        <mat-spinner diameter="50"></mat-spinner>
        <p>Loading exports...</p>
      </div>

      <!-- Empty State -->
      <div *ngIf="!isLoading && exports.length === 0" class="empty-state">
        <mat-icon class="empty-icon">file_download</mat-icon>
        <h3>No exports found</h3>
        <p>Create your first export to get started.</p>
        <button mat-raised-button color="primary" (click)="onCreateExport()">
          <mat-icon>add</mat-icon>
          Create Export
        </button>
      </div>

      <!-- Export List -->
      <div *ngIf="!isLoading && exports.length > 0" class="exports-list">
        <app-export-status
          *ngFor="let exportJob of exports; trackBy: trackByExportId"
          [exportJob]="exportJob"
          [autoRefresh]="true">
        </app-export-status>
      </div>

      <!-- Pagination -->
      <mat-paginator
        *ngIf="!isLoading && exports.length > 0"
        [length]="totalCount"
        [pageSize]="pageSize"
        [pageIndex]="currentPage - 1"
        [pageSizeOptions]="[10, 20, 50, 100]"
        (page)="onPageChange($event)"
        showFirstLastButtons>
      </mat-paginator>
    </div>
  `,
  styles: [`
    .export-history-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem;
    }

    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    .header-section h2 {
      margin: 0;
      color: #424242;
    }

    .filters-card {
      margin-bottom: 1rem;
    }

    .filters-form {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      align-items: end;
    }

    .clear-filters-btn {
      height: 56px; /* Match form field height */
    }

    .stats-card {
      margin-bottom: 2rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      text-align: center;
    }

    .stat-item {
      padding: 1rem;
      border-radius: 8px;
      background-color: #f8f9fa;
    }

    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #2196f3;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
    }

    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      margin-top: 0.5rem;
    }

    .star-icon {
      color: #ffc107;
      font-size: 20px;
    }

    .loading-section {
      text-align: center;
      padding: 4rem 1rem;
    }

    .loading-section p {
      margin-top: 1rem;
      color: #666;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 1rem;
    }

    .empty-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #ccc;
      margin-bottom: 1rem;
    }

    .empty-state h3 {
      color: #666;
      margin-bottom: 0.5rem;
    }

    .empty-state p {
      color: #999;
      margin-bottom: 2rem;
    }

    .exports-list {
      margin-bottom: 2rem;
    }

    mat-paginator {
      background-color: transparent;
    }

    @media (max-width: 768px) {
      .header-section {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
      }

      .filters-form {
        grid-template-columns: 1fr;
      }

      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `]
})
export class ExportHistoryComponent implements OnInit {
  filtersForm: FormGroup;
  workspaces: any[] = [];
  exports: ExportJobWithDetails[] = [];
  stats: any = null;

  isLoading = false;
  totalCount = 0;
  currentPage = 1;
  pageSize = 20;

  constructor(
    private fb: FormBuilder,
    private exportService: ExportService,
    private workspaceService: WorkspaceService,
    private dialog: MatDialog
  ) {
    this.filtersForm = this.fb.group({
      workspace_id: [''],
      export_type: [''],
      status: [''],
      search: ['']
    });
  }

  ngOnInit() {
    this.loadWorkspaces();
    this.loadExports();
    this.loadStats();

    // Set up reactive filtering
    this.filtersForm.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.currentPage = 1;
        this.loadExports();
      });
  }

  loadWorkspaces() {
    this.workspaceService.getWorkspaces().subscribe({
      next: (workspaces) => {
        this.workspaces = workspaces;
      },
      error: (error) => {
        console.error('Failed to load workspaces:', error);
      }
    });
  }

  loadExports() {
    this.isLoading = true;
    const filters = this.filtersForm.value;

    // Apply local filtering (in a real app, this would be server-side)
    this.exportService.getExportHistory(
      this.currentPage,
      this.pageSize,
      filters.workspace_id || undefined
    ).subscribe({
      next: (response: ExportHistoryResponse) => {
        let filteredExports = response.exports;

        // Apply client-side filters (in production, these should be server-side)
        if (filters.export_type) {
          filteredExports = filteredExports.filter(exp => exp.export_type === filters.export_type);
        }
        if (filters.status) {
          filteredExports = filteredExports.filter(exp => exp.status === filters.status);
        }
        if (filters.search) {
          const searchTerm = filters.search.toLowerCase();
          filteredExports = filteredExports.filter(exp =>
            exp.name.toLowerCase().includes(searchTerm) ||
            (exp.description && exp.description.toLowerCase().includes(searchTerm))
          );
        }

        this.exports = filteredExports;
        this.totalCount = response.total;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Failed to load exports:', error);
        this.isLoading = false;
      }
    });
  }

  loadStats() {
    const workspace_id = this.filtersForm.value.workspace_id;
    this.exportService.getExportStats(workspace_id || undefined).subscribe({
      next: (stats) => {
        this.stats = stats;
      },
      error: (error) => {
        console.error('Failed to load stats:', error);
      }
    });
  }

  onCreateExport() {
    const dialogRef = this.dialog.open(ExportCreateDialogComponent, {
      width: '600px',
      data: {
        workspace_id: this.filtersForm.value.workspace_id || undefined
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Export was created, refresh the list
        this.loadExports();
        this.loadStats();
      }
    });
  }

  onPageChange(event: PageEvent) {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadExports();
  }

  onClearFilters() {
    this.filtersForm.reset();
    this.currentPage = 1;
    this.loadExports();
    this.loadStats();
  }

  trackByExportId(index: number, exportJob: ExportJobWithDetails): string {
    return exportJob.id;
  }
}