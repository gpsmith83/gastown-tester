import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ExportService, CreateExportRequest } from '../services/export.service';
import { ProjectService } from '../services/project.service';
import { WorkspaceService } from '../services/workspace.service';

export interface ExportCreateDialogData {
  workspace_id?: string;
  project_id?: string;
  export_type?: 'requirements' | 'projects' | 'workspace';
}

@Component({
  selector: 'app-export-create-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatSelectModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <h2 mat-dialog-title>Create Export</h2>

    <mat-dialog-content class="export-create-content">
      <form [formGroup]="exportForm" class="export-form">
        <!-- Basic Information -->
        <div class="form-section">
          <h3>Export Details</h3>

          <mat-form-field appearance="fill" class="full-width">
            <mat-label>Export Name</mat-label>
            <input matInput formControlName="name" placeholder="My requirements export" required>
            <mat-error *ngIf="exportForm.get('name')?.hasError('required')">
              Export name is required
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="fill" class="full-width">
            <mat-label>Description (Optional)</mat-label>
            <textarea matInput formControlName="description" rows="2" placeholder="Brief description of this export"></textarea>
          </mat-form-field>
        </div>

        <!-- Export Configuration -->
        <div class="form-section">
          <h3>Export Configuration</h3>

          <mat-form-field appearance="fill">
            <mat-label>Export Type</mat-label>
            <mat-select formControlName="export_type" required>
              <mat-option value="requirements">Requirements</mat-option>
              <mat-option value="projects">Projects</mat-option>
              <mat-option value="workspace">Full Workspace</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="fill">
            <mat-label>Format</mat-label>
            <mat-select formControlName="format">
              <mat-option value="csv">CSV</mat-option>
              <mat-option value="json">JSON</mat-option>
              <mat-option value="xlsx">Excel (XLSX)</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Scope Selection -->
        <div class="form-section" *ngIf="!data.project_id && !data.workspace_id">
          <h3>Export Scope</h3>

          <mat-form-field appearance="fill" class="full-width" *ngIf="workspaces.length > 0">
            <mat-label>Workspace</mat-label>
            <mat-select formControlName="workspace_id" (selectionChange)="onWorkspaceChange($event.value)">
              <mat-option value="">All workspaces</mat-option>
              <mat-option *ngFor="let workspace of workspaces" [value]="workspace.id">
                {{workspace.name}}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="fill" class="full-width" *ngIf="projects.length > 0 && exportForm.value.export_type === 'requirements'">
            <mat-label>Project</mat-label>
            <mat-select formControlName="project_id">
              <mat-option value="">All projects</mat-option>
              <mat-option *ngFor="let project of projects" [value]="project.id">
                {{project.name}}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Column Selection -->
        <div class="form-section" *ngIf="availableColumns.length > 0">
          <h3>Columns to Export</h3>
          <div class="columns-selection">
            <mat-checkbox
              *ngFor="let column of availableColumns"
              [checked]="isColumnSelected(column.key)"
              (change)="toggleColumn(column.key, $event.checked)"
              class="column-checkbox">
              {{column.label}}
            </mat-checkbox>
          </div>
        </div>

        <!-- Advanced Options -->
        <div class="form-section" *ngIf="showAdvanced">
          <h3>Advanced Options</h3>

          <!-- Filters would go here in the future -->
          <p class="hint">Advanced filtering and custom options coming soon.</p>
        </div>

        <div class="form-section">
          <mat-checkbox [(ngModel)]="showAdvanced" [ngModelOptions]="{standalone: true}">
            Show advanced options
          </mat-checkbox>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="exportForm.invalid || isCreating"
        (click)="onCreate()">
        <mat-spinner *ngIf="isCreating" diameter="20"></mat-spinner>
        <span *ngIf="!isCreating">Create Export</span>
        <span *ngIf="isCreating">Creating...</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .export-create-content {
      min-width: 500px;
      max-width: 600px;
    }

    .export-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-section {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
    }

    .form-section h3 {
      margin: 0 0 1rem 0;
      color: #424242;
      font-size: 16px;
      font-weight: 500;
    }

    .full-width {
      width: 100%;
    }

    .columns-selection {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.5rem;
    }

    .column-checkbox {
      margin: 0.25rem 0;
    }

    .hint {
      color: #666;
      font-style: italic;
      margin: 0;
    }

    mat-dialog-actions {
      margin-top: 1rem;
    }

    mat-spinner {
      margin-right: 8px;
    }
  `]
})
export class ExportCreateDialogComponent implements OnInit {
  exportForm: FormGroup;
  workspaces: any[] = [];
  projects: any[] = [];
  isCreating = false;
  showAdvanced = false;

  availableColumns = [
    { key: 'id', label: 'ID' },
    { key: 'title', label: 'Title' },
    { key: 'description', label: 'Description' },
    { key: 'priority', label: 'Priority' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'author', label: 'Author' },
    { key: 'project', label: 'Project' },
    { key: 'created_at', label: 'Created Date' },
    { key: 'updated_at', label: 'Updated Date' }
  ];

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<ExportCreateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ExportCreateDialogData,
    private exportService: ExportService,
    private projectService: ProjectService,
    private workspaceService: WorkspaceService
  ) {
    this.exportForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      description: [''],
      export_type: [data.export_type || 'requirements', [Validators.required]],
      format: ['csv', [Validators.required]],
      workspace_id: [data.workspace_id || ''],
      project_id: [data.project_id || ''],
      columns: [['id', 'title', 'status', 'created_at']] // Default columns
    });
  }

  ngOnInit() {
    this.loadWorkspaces();
    this.loadProjects();

    // Set up reactive form changes
    this.exportForm.get('export_type')?.valueChanges.subscribe(type => {
      this.updateAvailableColumns(type);
    });

    // Generate default name based on type and scope
    this.exportForm.get('export_type')?.valueChanges.subscribe(() => {
      this.generateDefaultName();
    });

    this.exportForm.get('workspace_id')?.valueChanges.subscribe(() => {
      this.generateDefaultName();
    });

    this.exportForm.get('project_id')?.valueChanges.subscribe(() => {
      this.generateDefaultName();
    });

    this.updateAvailableColumns(this.exportForm.value.export_type);
    this.generateDefaultName();
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

  loadProjects() {
    if (this.data.workspace_id) {
      this.projectService.getProjectsByWorkspace(this.data.workspace_id).subscribe({
        next: (response) => {
          this.projects = response.projects || [];
        },
        error: (error) => {
          console.error('Failed to load projects:', error);
        }
      });
    }
  }

  onWorkspaceChange(workspaceId: string) {
    // Load projects for the selected workspace
    if (workspaceId) {
      this.projectService.getProjectsByWorkspace(workspaceId).subscribe({
        next: (response) => {
          this.projects = response.projects || [];
          // Reset project selection
          this.exportForm.patchValue({ project_id: '' });
        },
        error: (error) => {
          console.error('Failed to load projects:', error);
          this.projects = [];
        }
      });
    } else {
      this.projects = [];
      this.exportForm.patchValue({ project_id: '' });
    }
  }

  updateAvailableColumns(exportType: string) {
    if (exportType === 'projects') {
      this.availableColumns = [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: 'description', label: 'Description' },
        { key: 'status', label: 'Status' },
        { key: 'product_area', label: 'Product Area' },
        { key: 'workspace', label: 'Workspace' },
        { key: 'owner', label: 'Owner' },
        { key: 'created_at', label: 'Created Date' },
        { key: 'updated_at', label: 'Updated Date' }
      ];
      // Reset to default project columns
      this.exportForm.patchValue({
        columns: ['id', 'name', 'status', 'created_at']
      });
    } else {
      this.availableColumns = [
        { key: 'id', label: 'ID' },
        { key: 'title', label: 'Title' },
        { key: 'description', label: 'Description' },
        { key: 'priority', label: 'Priority' },
        { key: 'type', label: 'Type' },
        { key: 'status', label: 'Status' },
        { key: 'author', label: 'Author' },
        { key: 'project', label: 'Project' },
        { key: 'created_at', label: 'Created Date' },
        { key: 'updated_at', label: 'Updated Date' }
      ];
      // Reset to default requirement columns
      this.exportForm.patchValue({
        columns: ['id', 'title', 'status', 'created_at']
      });
    }
  }

  generateDefaultName() {
    const formValue = this.exportForm.value;
    const type = this.exportService.formatExportType(formValue.export_type);
    const date = new Date().toISOString().slice(0, 10);

    let scope = '';
    if (formValue.project_id) {
      const project = this.projects.find(p => p.id === formValue.project_id);
      scope = project ? ` - ${project.name}` : '';
    } else if (formValue.workspace_id) {
      const workspace = this.workspaces.find(w => w.id === formValue.workspace_id);
      scope = workspace ? ` - ${workspace.name}` : '';
    }

    const name = `${type} Export${scope} - ${date}`;
    this.exportForm.patchValue({ name }, { emitEvent: false });
  }

  isColumnSelected(columnKey: string): boolean {
    const selectedColumns = this.exportForm.value.columns || [];
    return selectedColumns.includes(columnKey);
  }

  toggleColumn(columnKey: string, checked: boolean) {
    const currentColumns = this.exportForm.value.columns || [];
    let newColumns;

    if (checked) {
      newColumns = [...currentColumns, columnKey];
    } else {
      newColumns = currentColumns.filter((col: string) => col !== columnKey);
    }

    this.exportForm.patchValue({ columns: newColumns });
  }

  onCancel() {
    this.dialogRef.close();
  }

  onCreate() {
    if (this.exportForm.invalid) {
      return;
    }

    this.isCreating = true;
    const formValue = this.exportForm.value;

    const request: CreateExportRequest = {
      name: formValue.name,
      description: formValue.description || undefined,
      export_type: formValue.export_type,
      format: formValue.format,
      workspace_id: formValue.workspace_id || undefined,
      project_id: formValue.project_id || undefined,
      columns: formValue.columns
    };

    this.exportService.createExport(request).subscribe({
      next: (response) => {
        this.dialogRef.close(response.export_job);
      },
      error: (error) => {
        console.error('Export creation failed:', error);
        this.isCreating = false;
        // TODO: Show error message to user
      }
    });
  }
}