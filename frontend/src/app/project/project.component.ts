import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../services/project.service';
import { AuthService } from '../services/auth.service';
import { RequirementService } from '../services/requirement.service';
import { ProjectWithDetails, CreateProjectRequest } from '../models/workspace.model';
import { RequirementWithDetails, CreateRequirementRequest } from '../models/requirement.model';

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

  // Requirement creation modal properties
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
        this.loadRequirements(); // Load requirements after project is loaded
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

  // Load requirements for the current project
  loadRequirements(): void {
    if (!this.projectId) return;

    this.loadingRequirements = true;
    this.requirementError = null;

    this.requirementService.getProjectRequirements(this.projectId).subscribe({
      next: (requirements) => {
        this.projectRequirements = requirements;
        this.loadingRequirements = false;
      },
      error: (error) => {
        console.error('Failed to load requirements:', error);
        this.requirementError = 'Failed to load requirements. Please try again.';
        this.loadingRequirements = false;
      }
    });
  }

  // Get count of requirements by status for summary display
  getRequirementCountByStatus(status: string): number {
    return this.projectRequirements.filter(req => req.status === status).length;
  }

  // Track function for ngFor performance
  trackRequirement(index: number, requirement: RequirementWithDetails): string {
    return requirement.id;
  }

  // Navigate to requirement detail view
  navigateToRequirement(requirementId: string): void {
    // For now, we'll navigate to the requirement route with the ID
    // This assumes a requirement detail component/route exists
    this.router.navigate(['/requirement'], { queryParams: { id: requirementId } });
  }

  // Handle creating first requirement
  createFirstRequirement(): void {
    this.openCreateRequirementModal();
  }

  // Open requirement creation modal
  openCreateRequirementModal(): void {
    if (!this.projectId) return;

    // Reset form and error state
    this.createRequirementForm = {
      title: '',
      description: '',
      project_id: this.projectId,
      priority: 3,
      type: 'feature'
    };
    this.createRequirementError = null;
    this.showCreateRequirementModal = true;
  }

  // Close requirement creation modal
  closeCreateRequirementModal(): void {
    this.showCreateRequirementModal = false;
    this.createRequirementError = null;
  }

  // Submit requirement creation form
  submitCreateRequirement(): void {
    if (!this.createRequirementForm.title.trim()) {
      this.createRequirementError = 'Title is required';
      return;
    }

    this.creatingRequirement = true;
    this.createRequirementError = null;

    // Prepare the request data
    const requestData: CreateRequirementRequest = {
      ...this.createRequirementForm,
      title: this.createRequirementForm.title.trim(),
      description: this.createRequirementForm.description?.trim() || ''
    };

    this.requirementService.createRequirement(requestData).subscribe({
      next: (newRequirement) => {
        console.log('Requirement created successfully:', newRequirement);

        // Close modal
        this.closeCreateRequirementModal();

        // Refresh requirements list
        this.loadRequirements();

        // Navigate to the new requirement detail page
        this.router.navigate(['/requirement'], { queryParams: { id: newRequirement.id } });
      },
      error: (error) => {
        console.error('Failed to create requirement:', error);
        this.createRequirementError = 'Failed to create requirement. Please try again.';
        this.creatingRequirement = false;
      }
    });
  }

  get canEdit(): boolean {
    return this.project?.owner?.id === this.authService.currentUser?.id;
  }
}
