import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

/**
 * Linear Service for frontend Linear connection management
 * Implements B-502: Build Linear connection UI
 */

export interface LinearConnection {
  id: string;
  project_id: string;
  workspace_id: string;
  workspace_name?: string;
  team_id: string;
  team_name?: string;
  board_id?: string;
  board_name?: string;
  project_id_linear?: string;
  project_name_linear?: string;
  is_validated: boolean;
  validation_error?: string;
  last_validated_at?: Date;
  linear_organization_id?: string;
  linear_organization_name?: string;
  permissions?: string[];
  created_at: Date;
  updated_at: Date;
}

export interface CreateLinearConnectionRequest {
  api_token: string;
  workspace_id: string;
  team_id: string;
  board_id?: string;
  project_id_linear?: string;
}

export interface UpdateLinearConnectionRequest {
  workspace_id?: string;
  team_id?: string;
  board_id?: string;
  project_id_linear?: string;
}

export interface LinearConnectionValidationResult {
  is_valid: boolean;
  workspace?: {
    id: string;
    name: string;
  };
  team?: {
    id: string;
    name: string;
  };
  board?: {
    id: string;
    name: string;
  };
  project?: {
    id: string;
    name: string;
  };
  organization?: {
    id: string;
    name: string;
  };
  permissions?: string[];
  error?: string;
}

export interface LinearWorkspace {
  id: string;
  name: string;
  teams: LinearTeam[];
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
  projects?: LinearProject[];
}

export interface LinearProject {
  id: string;
  name: string;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LinearService {
  private readonly API_BASE = 'http://localhost:3000/api/linear';

  constructor(private http: HttpClient) {}

  /**
   * Get Linear connection for a project
   */
  getConnection(projectId: string): Observable<LinearConnection> {
    return this.http.get<{ connection: LinearConnection }>(`${this.API_BASE}/projects/${projectId}/connection`, { withCredentials: true })
      .pipe(
        map(response => response.connection),
        catchError(error => {
          console.error('Failed to fetch Linear connection:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Create Linear connection for a project
   */
  createConnection(projectId: string, connectionData: CreateLinearConnectionRequest): Observable<LinearConnection> {
    return this.http.post<{ connection: LinearConnection; message: string }>(
      `${this.API_BASE}/projects/${projectId}/connection`,
      connectionData,
      { withCredentials: true }
    ).pipe(
      map(response => response.connection),
      catchError(error => {
        console.error('Failed to create Linear connection:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update Linear connection for a project
   */
  updateConnection(projectId: string, connectionData: UpdateLinearConnectionRequest): Observable<LinearConnection> {
    return this.http.put<{ connection: LinearConnection; message: string }>(
      `${this.API_BASE}/projects/${projectId}/connection`,
      connectionData,
      { withCredentials: true }
    ).pipe(
      map(response => response.connection),
      catchError(error => {
        console.error('Failed to update Linear connection:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Validate Linear connection
   */
  validateConnection(projectId: string, apiToken: string): Observable<LinearConnectionValidationResult> {
    return this.http.post<{ validation_result: LinearConnectionValidationResult; message: string }>(
      `${this.API_BASE}/projects/${projectId}/connection/validate`,
      { api_token: apiToken },
      { withCredentials: true }
    ).pipe(
      map(response => response.validation_result),
      catchError(error => {
        console.error('Failed to validate Linear connection:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete Linear connection for a project
   */
  deleteConnection(projectId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_BASE}/projects/${projectId}/connection`, { withCredentials: true })
      .pipe(
        catchError(error => {
          console.error('Failed to delete Linear connection:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Test Linear API token and fetch available workspaces/teams
   * This would typically require a separate endpoint for browsing Linear data
   * For MVP, we'll simulate the response structure
   */
  testApiToken(apiToken: string): Observable<{
    valid: boolean;
    workspaces?: LinearWorkspace[];
    organization?: {
      id: string;
      name: string;
    };
    user?: {
      id: string;
      name: string;
      email: string;
    };
    error?: string;
  }> {
    // For MVP, simulate validation response
    // In production, this would call a separate endpoint to test the token
    return new Promise<any>((resolve) => {
      setTimeout(() => {
        if (apiToken.startsWith('lin_api_')) {
          resolve({
            valid: true,
            organization: {
              id: 'org_123',
              name: 'Example Organization'
            },
            user: {
              id: 'user_456',
              name: 'Test User',
              email: 'user@example.com'
            },
            workspaces: [
              {
                id: 'workspace_1',
                name: 'Engineering',
                teams: [
                  {
                    id: 'team_1',
                    name: 'Frontend',
                    key: 'FE',
                    projects: [
                      { id: 'proj_1', name: 'Mobile App', description: 'iOS and Android app' },
                      { id: 'proj_2', name: 'Web Dashboard', description: 'React admin panel' }
                    ]
                  },
                  {
                    id: 'team_2',
                    name: 'Backend',
                    key: 'BE',
                    projects: [
                      { id: 'proj_3', name: 'API Platform', description: 'Core API services' }
                    ]
                  }
                ]
              },
              {
                id: 'workspace_2',
                name: 'Product',
                teams: [
                  {
                    id: 'team_3',
                    name: 'Design',
                    key: 'DES',
                    projects: [
                      { id: 'proj_4', name: 'Design System', description: 'Component library' }
                    ]
                  }
                ]
              }
            ]
          });
        } else {
          resolve({
            valid: false,
            error: 'Invalid API token format. Please provide a valid Linear API token.'
          });
        }
      }, 1000); // Simulate network delay
    }).then(result => new Observable(observer => {
      observer.next(result);
      observer.complete();
    }));
  }

  /**
   * Format connection status for display
   */
  getConnectionStatusInfo(connection: LinearConnection): {
    status: 'connected' | 'error' | 'pending';
    statusText: string;
    statusClass: string;
    showActions: boolean;
  } {
    if (!connection.is_validated) {
      return {
        status: 'pending',
        statusText: 'Validation Pending',
        statusClass: 'status-pending',
        showActions: true
      };
    }

    if (connection.validation_error) {
      return {
        status: 'error',
        statusText: `Error: ${connection.validation_error}`,
        statusClass: 'status-error',
        showActions: true
      };
    }

    return {
      status: 'connected',
      statusText: 'Connected & Validated',
      statusClass: 'status-connected',
      showActions: true
    };
  }

  /**
   * Format connection summary for display
   */
  getConnectionSummary(connection: LinearConnection): string {
    const parts = [];

    if (connection.workspace_name) {
      parts.push(`Workspace: ${connection.workspace_name}`);
    }

    if (connection.team_name) {
      parts.push(`Team: ${connection.team_name}`);
    }

    if (connection.project_name_linear) {
      parts.push(`Project: ${connection.project_name_linear}`);
    }

    if (connection.board_name) {
      parts.push(`Board: ${connection.board_name}`);
    }

    return parts.join(' • ');
  }
}