import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LinearService,
  LinearConnection,
  CreateLinearConnectionRequest,
  LinearWorkspace,
  LinearTeam,
  LinearProject
} from '../services/linear.service';

/**
 * Linear Connection Component
 * Implements B-502: Build Linear connection UI
 *
 * Provides UI for:
 * - Setting up new Linear connections
 * - Validating Linear connections
 * - Managing existing connections
 * - Selecting workspaces, teams, and projects
 */
@Component({
  selector: 'app-linear-connection',
  imports: [CommonModule, FormsModule],
  templateUrl: './linear-connection.component.html',
  styleUrl: './linear-connection.component.css'
})
export class LinearConnectionComponent implements OnInit {
  @Input() projectId!: string;
  @Input() canEdit = false;

  // Connection state
  connection: LinearConnection | null = null;
  isLoadingConnection = true;
  connectionError: string | null = null;

  // Setup flow state
  showSetupFlow = false;
  setupStep: 'token' | 'selection' | 'validation' | 'complete' = 'token';

  // Form data
  apiToken = '';
  selectedWorkspaceId = '';
  selectedTeamId = '';
  selectedBoardId = '';
  selectedProjectId = '';

  // Available options from Linear API
  availableWorkspaces: LinearWorkspace[] = [];
  availableTeams: LinearTeam[] = [];
  availableProjects: LinearProject[] = [];

  // UI state
  isTestingToken = false;
  isCreatingConnection = false;
  isValidatingConnection = false;
  setupError: string | null = null;
  tokenTestResult: any = null;

  constructor(private linearService: LinearService) {}

  ngOnInit(): void {
    if (this.projectId) {
      this.loadConnection();
    }
  }

  /**
   * Load existing Linear connection for the project
   */
  loadConnection(): void {
    this.isLoadingConnection = true;
    this.connectionError = null;

    this.linearService.getConnection(this.projectId).subscribe({
      next: (connection) => {
        this.connection = connection;
        this.isLoadingConnection = false;
      },
      error: (error) => {
        if (error.status === 404) {
          // No connection exists yet
          this.connection = null;
        } else {
          this.connectionError = 'Failed to load Linear connection. Please try again.';
          console.error('Error loading Linear connection:', error);
        }
        this.isLoadingConnection = false;
      }
    });
  }

  /**
   * Start the Linear connection setup flow
   */
  startSetup(): void {
    this.showSetupFlow = true;
    this.setupStep = 'token';
    this.resetSetupForm();
  }

  /**
   * Cancel setup flow
   */
  cancelSetup(): void {
    this.showSetupFlow = false;
    this.resetSetupForm();
  }

  /**
   * Reset setup form data
   */
  resetSetupForm(): void {
    this.apiToken = '';
    this.selectedWorkspaceId = '';
    this.selectedTeamId = '';
    this.selectedBoardId = '';
    this.selectedProjectId = '';
    this.availableWorkspaces = [];
    this.availableTeams = [];
    this.availableProjects = [];
    this.setupError = null;
    this.tokenTestResult = null;
  }

  /**
   * Test the Linear API token and load available options
   */
  testApiToken(): void {
    if (!this.apiToken.trim()) {
      this.setupError = 'Please enter your Linear API token.';
      return;
    }

    this.isTestingToken = true;
    this.setupError = null;

    this.linearService.testApiToken(this.apiToken).subscribe({
      next: (result) => {
        this.isTestingToken = false;

        if (result.valid) {
          this.tokenTestResult = result;
          this.availableWorkspaces = result.workspaces || [];
          this.setupStep = 'selection';

          // Pre-select first workspace if only one available
          if (this.availableWorkspaces.length === 1) {
            this.selectedWorkspaceId = this.availableWorkspaces[0].id;
            this.onWorkspaceChange();
          }
        } else {
          this.setupError = result.error || 'Invalid API token.';
        }
      },
      error: (error) => {
        this.isTestingToken = false;
        this.setupError = 'Failed to validate API token. Please check your token and try again.';
        console.error('Token validation error:', error);
      }
    });
  }

  /**
   * Handle workspace selection change
   */
  onWorkspaceChange(): void {
    this.selectedTeamId = '';
    this.selectedBoardId = '';
    this.selectedProjectId = '';
    this.availableTeams = [];
    this.availableProjects = [];

    const selectedWorkspace = this.availableWorkspaces.find(w => w.id === this.selectedWorkspaceId);
    if (selectedWorkspace) {
      this.availableTeams = selectedWorkspace.teams || [];

      // Pre-select first team if only one available
      if (this.availableTeams.length === 1) {
        this.selectedTeamId = this.availableTeams[0].id;
        this.onTeamChange();
      }
    }
  }

  /**
   * Handle team selection change
   */
  onTeamChange(): void {
    this.selectedBoardId = '';
    this.selectedProjectId = '';
    this.availableProjects = [];

    const selectedTeam = this.availableTeams.find(t => t.id === this.selectedTeamId);
    if (selectedTeam) {
      this.availableProjects = selectedTeam.projects || [];
    }
  }

  /**
   * Proceed to validation step
   */
  proceedToValidation(): void {
    if (!this.selectedWorkspaceId || !this.selectedTeamId) {
      this.setupError = 'Please select both a workspace and team.';
      return;
    }

    this.setupStep = 'validation';
    this.setupError = null;
  }

  /**
   * Create the Linear connection
   */
  createConnection(): void {
    if (!this.apiToken || !this.selectedWorkspaceId || !this.selectedTeamId) {
      this.setupError = 'Please complete all required fields.';
      return;
    }

    this.isCreatingConnection = true;
    this.setupError = null;

    const connectionData: CreateLinearConnectionRequest = {
      api_token: this.apiToken,
      workspace_id: this.selectedWorkspaceId,
      team_id: this.selectedTeamId,
      board_id: this.selectedBoardId || undefined,
      project_id_linear: this.selectedProjectId || undefined
    };

    this.linearService.createConnection(this.projectId, connectionData).subscribe({
      next: (connection) => {
        this.isCreatingConnection = false;
        this.connection = connection;
        this.setupStep = 'complete';

        // Auto-close setup flow after success
        setTimeout(() => {
          this.showSetupFlow = false;
          this.resetSetupForm();
        }, 2000);
      },
      error: (error) => {
        this.isCreatingConnection = false;
        this.setupError = error.error?.message || 'Failed to create Linear connection. Please try again.';
        console.error('Connection creation error:', error);
      }
    });
  }

  /**
   * Validate existing connection
   */
  validateConnection(): void {
    if (!this.connection) return;

    // For validation, we need the API token. In a real implementation,
    // you might store this securely or ask user to re-enter it.
    const apiToken = prompt('Please enter your Linear API token to validate the connection:');

    if (!apiToken) return;

    this.isValidatingConnection = true;

    this.linearService.validateConnection(this.projectId, apiToken).subscribe({
      next: (result) => {
        this.isValidatingConnection = false;

        // Reload connection to get updated validation status
        this.loadConnection();

        if (result.is_valid) {
          alert('Linear connection validated successfully!');
        } else {
          alert(`Validation failed: ${result.error}`);
        }
      },
      error: (error) => {
        this.isValidatingConnection = false;
        alert(`Validation failed: ${error.error?.message || 'Unknown error'}`);
        console.error('Validation error:', error);
      }
    });
  }

  /**
   * Delete the Linear connection
   */
  deleteConnection(): void {
    if (!this.connection) return;

    const confirmed = confirm('Are you sure you want to delete this Linear connection? This action cannot be undone.');
    if (!confirmed) return;

    this.linearService.deleteConnection(this.projectId).subscribe({
      next: () => {
        this.connection = null;
        alert('Linear connection deleted successfully.');
      },
      error: (error) => {
        alert(`Failed to delete connection: ${error.error?.message || 'Unknown error'}`);
        console.error('Deletion error:', error);
      }
    });
  }

  /**
   * Get connection status information for display
   */
  getConnectionStatus(): any {
    if (!this.connection) return null;
    return this.linearService.getConnectionStatusInfo(this.connection);
  }

  /**
   * Get connection summary for display
   */
  getConnectionSummary(): string {
    if (!this.connection) return '';
    return this.linearService.getConnectionSummary(this.connection);
  }

  /**
   * Get selected workspace name
   */
  getSelectedWorkspaceName(): string {
    const workspace = this.availableWorkspaces.find(w => w.id === this.selectedWorkspaceId);
    return workspace?.name || '';
  }

  /**
   * Get selected team name
   */
  getSelectedTeamName(): string {
    const team = this.availableTeams.find(t => t.id === this.selectedTeamId);
    return team?.name || '';
  }

  /**
   * Get selected project name
   */
  getSelectedProjectName(): string {
    const project = this.availableProjects.find(p => p.id === this.selectedProjectId);
    return project?.name || '';
  }

  /**
   * Format last validated date
   */
  formatLastValidated(date: Date): string {
    return new Date(date).toLocaleString();
  }
}
