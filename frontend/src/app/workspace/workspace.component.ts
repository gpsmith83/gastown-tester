import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { WorkspaceService } from '../services/workspace.service';
import { ProjectService } from '../services/project.service';
import {
  WorkspaceWithProjects,
  CreateWorkspaceRequest,
  CreateProjectRequest,
  User
} from '../models/workspace.model';

@Component({
  selector: 'app-workspace',
  imports: [CommonModule, FormsModule],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.css'
})
export class WorkspaceComponent implements OnInit {
  currentUser: User | null = null;
  workspaces: WorkspaceWithProjects[] = [];
  selectedWorkspace: WorkspaceWithProjects | null = null;
  isLoading = true;
  error: string | null = null;

  // Modal states
  showCreateWorkspaceModal = false;
  showCreateProjectModal = false;

  // Form models
  newWorkspace: CreateWorkspaceRequest = {
    name: '',
    description: ''
  };

  newProject: CreateProjectRequest = {
    name: '',
    description: '',
    workspace_id: '',
    product_area: '',
    goals: [],
    default_labels: [],
    default_persona_stack: null
  };

  // Form input helpers
  goalInput = '';
  labelInput = '';

  constructor(
    private authService: AuthService,
    private workspaceService: WorkspaceService,
    private projectService: ProjectService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check authentication and load user data
    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (!isAuth) {
        this.router.navigate(['/signin']);
        return;
      }
    });

    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    // Load workspaces
    this.loadWorkspaces();
  }

  loadWorkspaces(): void {
    this.isLoading = true;
    this.error = null;

    this.workspaceService.getWorkspaces().subscribe({
      next: (workspaces) => {
        this.workspaces = workspaces;
        if (workspaces.length > 0 && !this.selectedWorkspace) {
          this.selectedWorkspace = workspaces[0];
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Failed to load workspaces:', error);
        this.error = 'Failed to load workspaces. Please try again.';
        this.isLoading = false;
      }
    });
  }

  selectWorkspace(workspace: WorkspaceWithProjects): void {
    this.selectedWorkspace = workspace;
  }

  // Workspace creation
  openCreateWorkspaceModal(): void {
    this.newWorkspace = { name: '', description: '' };
    this.showCreateWorkspaceModal = true;
  }

  closeCreateWorkspaceModal(): void {
    this.showCreateWorkspaceModal = false;
  }

  createWorkspace(): void {
    if (!this.newWorkspace.name.trim()) {
      return;
    }

    this.workspaceService.createWorkspace({
      name: this.newWorkspace.name.trim(),
      description: this.newWorkspace.description?.trim()
    }).subscribe({
      next: (workspace) => {
        this.workspaces.unshift({
          ...workspace,
          projects: [],
          member_count: 1
        });
        this.selectedWorkspace = this.workspaces[0];
        this.closeCreateWorkspaceModal();
      },
      error: (error) => {
        console.error('Failed to create workspace:', error);
        this.error = 'Failed to create workspace. Please try again.';
      }
    });
  }

  // Project creation
  openCreateProjectModal(): void {
    if (!this.selectedWorkspace) {
      return;
    }

    this.newProject = {
      name: '',
      description: '',
      workspace_id: this.selectedWorkspace.id,
      product_area: '',
      goals: [],
      default_labels: [],
      default_persona_stack: null
    };
    this.goalInput = '';
    this.labelInput = '';
    this.showCreateProjectModal = true;
  }

  closeCreateProjectModal(): void {
    this.showCreateProjectModal = false;
  }

  addGoal(): void {
    if (this.goalInput.trim()) {
      this.newProject.goals?.push(this.goalInput.trim());
      this.goalInput = '';
    }
  }

  removeGoal(index: number): void {
    this.newProject.goals?.splice(index, 1);
  }

  addLabel(): void {
    if (this.labelInput.trim()) {
      this.newProject.default_labels?.push(this.labelInput.trim());
      this.labelInput = '';
    }
  }

  removeLabel(index: number): void {
    this.newProject.default_labels?.splice(index, 1);
  }

  createProject(): void {
    if (!this.newProject.name.trim() || !this.selectedWorkspace) {
      return;
    }

    this.projectService.createProject({
      ...this.newProject,
      name: this.newProject.name.trim(),
      description: this.newProject.description?.trim(),
      product_area: this.newProject.product_area?.trim()
    }).subscribe({
      next: (project) => {
        // Add project to the selected workspace
        if (this.selectedWorkspace && this.selectedWorkspace.projects) {
          this.selectedWorkspace.projects.unshift(project);
        }
        this.closeCreateProjectModal();
      },
      error: (error) => {
        console.error('Failed to create project:', error);
        this.error = 'Failed to create project. Please try again.';
      }
    });
  }

  navigateToProject(projectId: string): void {
    this.router.navigate(['/project'], { queryParams: { id: projectId } });
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/signin']);
      },
      error: (error) => {
        console.error('Logout failed:', error);
        // Even if logout API fails, clear the local state
        this.router.navigate(['/signin']);
      }
    });
  }
}
