import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../services/project.service';
import { AuthService } from '../services/auth.service';
import { ProjectWithDetails, CreateProjectRequest } from '../models/workspace.model';

@Component({
  selector: 'app-project',
  imports: [CommonModule, FormsModule],
  templateUrl: './project.component.html',
  styleUrl: './project.component.css'
})
export class ProjectComponent implements OnInit {
  project: ProjectWithDetails | null = null;
  isLoading = true;
  isEditing = false;
  error: string | null = null;
  projectId: string | null = null;

  // Edit form
  editForm: Partial<CreateProjectRequest> = {};

  // Form input helpers
  goalInput = '';
  labelInput = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Check authentication
    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (!isAuth) {
        this.router.navigate(['/signin']);
        return;
      }
    });

    // Get project ID from query parameters
    this.route.queryParams.subscribe(params => {
      this.projectId = params['id'];
      if (this.projectId) {
        this.loadProject();
      } else {
        this.error = 'No project ID provided';
        this.isLoading = false;
      }
    });
  }

  loadProject(): void {
    if (!this.projectId) return;

    this.isLoading = true;
    this.error = null;

    this.projectService.getProject(this.projectId).subscribe({
      next: (project) => {
        this.project = project;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Failed to load project:', error);
        this.error = 'Failed to load project. Please try again.';
        this.isLoading = false;
      }
    });
  }

  startEdit(): void {
    if (!this.project) return;

    this.editForm = {
      name: this.project.name,
      description: this.project.description || '',
      product_area: this.project.product_area || '',
      goals: [...(this.project.goals || [])],
      default_labels: [...(this.project.default_labels || [])],
      default_persona_stack: this.project.default_persona_stack
    };
    this.goalInput = '';
    this.labelInput = '';
    this.isEditing = true;
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.editForm = {};
    this.goalInput = '';
    this.labelInput = '';
  }

  saveProject(): void {
    if (!this.project || !this.editForm.name?.trim()) return;

    this.projectService.updateProject(this.project.id, {
      ...this.editForm,
      name: this.editForm.name?.trim(),
      description: this.editForm.description?.trim(),
      product_area: this.editForm.product_area?.trim()
    }).subscribe({
      next: (updatedProject) => {
        this.project = updatedProject;
        this.isEditing = false;
        this.editForm = {};
      },
      error: (error) => {
        console.error('Failed to update project:', error);
        this.error = 'Failed to update project. Please try again.';
      }
    });
  }

  addGoal(): void {
    if (this.goalInput.trim() && this.editForm.goals) {
      this.editForm.goals.push(this.goalInput.trim());
      this.goalInput = '';
    }
  }

  removeGoal(index: number): void {
    if (this.editForm.goals) {
      this.editForm.goals.splice(index, 1);
    }
  }

  addLabel(): void {
    if (this.labelInput.trim() && this.editForm.default_labels) {
      this.editForm.default_labels.push(this.labelInput.trim());
      this.labelInput = '';
    }
  }

  removeLabel(index: number): void {
    if (this.editForm.default_labels) {
      this.editForm.default_labels.splice(index, 1);
    }
  }

  updateStatus(status: 'active' | 'archived' | 'draft'): void {
    if (!this.project) return;

    this.projectService.updateProjectStatus(this.project.id, status).subscribe({
      next: (updatedProject) => {
        if (this.project) {
          this.project.status = updatedProject.status;
        }
      },
      error: (error) => {
        console.error('Failed to update project status:', error);
        this.error = 'Failed to update project status. Please try again.';
      }
    });
  }

  deleteProject(): void {
    if (!this.project || !confirm('Are you sure you want to archive this project?')) {
      return;
    }

    this.projectService.deleteProject(this.project.id).subscribe({
      next: () => {
        this.router.navigate(['/workspace']);
      },
      error: (error) => {
        console.error('Failed to delete project:', error);
        this.error = 'Failed to delete project. Please try again.';
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/workspace']);
  }

  get canEdit(): boolean {
    return this.project?.owner?.id === this.authService.currentUser?.id;
  }
}
