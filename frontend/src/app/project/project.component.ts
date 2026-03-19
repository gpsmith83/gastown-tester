import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../services/project.service';
import { AuthService } from '../services/auth.service';
import { RequirementService } from '../services/requirement.service';
import { ProjectWithDetails, CreateProjectRequest } from '../models/workspace.model';
import { RequirementWithDetails, CreateRequirementRequest, RequirementFormData } from '../models/requirement.model';

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

  // Requirements-related properties
  projectRequirements: RequirementWithDetails[] = [];
  loadingRequirements = false;
  requirementError: string | null = null;

  // Requirement creation - full modal form approach
  showCreateRequirementModal = false;
  createRequirementForm: CreateRequirementRequest = {
    title: '',
    description: '',
    project_id: '',
    priority: 3,
    type: 'feature'
  };
  creatingRequirement = false;
  createRequirementError: string | null = null;

  // Requirement creation - simple prompt-based form approach
  showRequirementForm = false;
  isCreatingRequirement = false;
  requirementForm: RequirementFormData = {
    prompt: '',
    contextNotes: ''
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private authService: AuthService,
    private requirementService: RequirementService
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
        this.loadProjectRequirements();
      },
      error: (error) => {
        console.error('Error loading project:', error);
        this.error = 'Failed to load project details. Please try again.';
        this.isLoading = false;
      }
    });
  }

  loadProjectRequirements(): void {
    if (!this.projectId) return;

    this.loadingRequirements = true;
    this.requirementError = null;

    this.requirementService.getProjectRequirements(this.projectId).subscribe({
      next: (requirements) => {
        this.projectRequirements = requirements;
        this.loadingRequirements = false;
      },
      error: (error) => {
        console.error('Error loading project requirements:', error);
        this.requirementError = 'Failed to load project requirements.';
        this.loadingRequirements = false;
      }
    });
  }

  startEditing(): void {
    if (!this.project) return;

    this.editForm = {
      name: this.project.name,
      description: this.project.description,
      product_area: this.project.product_area,
      goals: [...(this.project.goals || [])],
      default_labels: [...(this.project.default_labels || [])],
      status: this.project.status
    };

    this.isEditing = true;
  }

  cancelEditing(): void {
    this.isEditing = false;
    this.editForm = {};
    this.goalInput = '';
    this.labelInput = '';
  }

  saveProject(): void {
    if (!this.project || !this.projectId) return;

    this.projectService.updateProject(this.projectId, this.editForm).subscribe({
      next: (updatedProject) => {
        this.project = updatedProject;
        this.isEditing = false;
        this.editForm = {};
        this.goalInput = '';
        this.labelInput = '';
      },
      error: (error) => {
        console.error('Error updating project:', error);
        this.error = 'Failed to update project. Please try again.';
      }
    });
  }

  // Goal management
  addGoal(): void {
    if (this.goalInput.trim()) {
      this.editForm.goals = this.editForm.goals || [];
      this.editForm.goals.push(this.goalInput.trim());
      this.goalInput = '';
    }
  }

  removeGoal(index: number): void {
    if (this.editForm.goals) {
      this.editForm.goals.splice(index, 1);
    }
  }

  // Label management
  addLabel(): void {
    if (this.labelInput.trim()) {
      this.editForm.default_labels = this.editForm.default_labels || [];
      this.editForm.default_labels.push(this.labelInput.trim());
      this.labelInput = '';
    }
  }

  removeLabel(index: number): void {
    if (this.editForm.default_labels) {
      this.editForm.default_labels.splice(index, 1);
    }
  }

  // Navigation
  navigateToRequirement(requirementId: string): void {
    this.router.navigate(['/requirement'], { queryParams: { id: requirementId } });
  }

  navigateToWorkspace(): void {
    if (this.project?.workspace_id) {
      this.router.navigate(['/workspace'], { queryParams: { id: this.project.workspace_id } });
    }
  }

  // Modal-based requirement creation
  openCreateRequirementModal(): void {
    this.createRequirementForm = {
      title: '',
      description: '',
      project_id: this.projectId || '',
      priority: 3,
      type: 'feature'
    };
    this.createRequirementError = null;
    this.showCreateRequirementModal = true;
  }

  closeCreateRequirementModal(): void {
    this.showCreateRequirementModal = false;
    this.createRequirementForm = {
      title: '',
      description: '',
      project_id: '',
      priority: 3,
      type: 'feature'
    };
    this.createRequirementError = null;
  }

  createRequirement(): void {
    if (!this.createRequirementForm.title.trim()) {
      this.createRequirementError = 'Title is required';
      return;
    }

    this.creatingRequirement = true;
    this.createRequirementError = null;

    this.requirementService.createRequirement(this.createRequirementForm).subscribe({
      next: (newRequirement) => {
        this.projectRequirements = [newRequirement, ...this.projectRequirements];
        this.closeCreateRequirementModal();
        this.creatingRequirement = false;
      },
      error: (error) => {
        console.error('Error creating requirement:', error);
        this.createRequirementError = 'Failed to create requirement. Please try again.';
        this.creatingRequirement = false;
      }
    });
  }

  // Simple form-based requirement creation
  openRequirementForm(): void {
    this.requirementForm = {
      prompt: '',
      contextNotes: ''
    };
    this.requirementError = null;
    this.showRequirementForm = true;
  }

  closeRequirementForm(): void {
    this.showRequirementForm = false;
    this.requirementForm = {
      prompt: '',
      contextNotes: ''
    };
    this.requirementError = null;
  }

  createRequirementFromForm(): void {
    if (!this.requirementForm.prompt.trim()) {
      this.requirementError = 'Prompt is required';
      return;
    }

    if (!this.projectId) {
      this.requirementError = 'Project ID is missing';
      return;
    }

    this.isCreatingRequirement = true;
    this.requirementError = null;

    this.requirementService.createRequirementFromForm(this.projectId, this.requirementForm).subscribe({
      next: (newRequirement) => {
        this.projectRequirements = [newRequirement, ...this.projectRequirements];
        this.closeRequirementForm();
        this.isCreatingRequirement = false;
      },
      error: (error) => {
        console.error('Error creating requirement:', error);
        this.requirementError = 'Failed to create requirement. Please try again.';
        this.isCreatingRequirement = false;
      }
    });
  }

  // Helper methods for priority and type labels
  getPriorityLabel(priority: number): string {
    const labels = ['', 'Critical', 'High', 'Medium', 'Low', 'Minor'];
    return labels[priority] || 'Unknown';
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  getTypeClass(type: string): string {
    return `type-${type}`;
  }
}