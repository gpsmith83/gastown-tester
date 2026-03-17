import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  Workspace,
  WorkspaceWithProjects,
  CreateWorkspaceRequest,
  WorkspacesResponse
} from '../models/workspace.model';

@Injectable({
  providedIn: 'root'
})
export class WorkspaceService {
  private readonly API_BASE = 'http://localhost:3000/api/workspaces';

  constructor(private http: HttpClient) {}

  /**
   * Get all workspaces for the current user
   */
  getWorkspaces(): Observable<WorkspaceWithProjects[]> {
    return this.http.get<WorkspacesResponse>(this.API_BASE, { withCredentials: true })
      .pipe(
        map(response => response.workspaces),
        catchError(error => {
          console.error('Failed to fetch workspaces:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get a specific workspace by ID
   */
  getWorkspace(id: string): Observable<Workspace> {
    return this.http.get<{ workspace: Workspace }>(`${this.API_BASE}/${id}`, { withCredentials: true })
      .pipe(
        map(response => response.workspace),
        catchError(error => {
          console.error('Failed to fetch workspace:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Create a new workspace
   */
  createWorkspace(workspace: CreateWorkspaceRequest): Observable<Workspace> {
    return this.http.post<{ workspace: Workspace; message: string }>(
      this.API_BASE,
      workspace,
      { withCredentials: true }
    ).pipe(
      map(response => response.workspace),
      catchError(error => {
        console.error('Failed to create workspace:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update an existing workspace
   */
  updateWorkspace(id: string, updates: Partial<CreateWorkspaceRequest>): Observable<Workspace> {
    return this.http.put<{ workspace: Workspace; message: string }>(
      `${this.API_BASE}/${id}`,
      updates,
      { withCredentials: true }
    ).pipe(
      map(response => response.workspace),
      catchError(error => {
        console.error('Failed to update workspace:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete a workspace
   */
  deleteWorkspace(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_BASE}/${id}`, { withCredentials: true })
      .pipe(
        catchError(error => {
          console.error('Failed to delete workspace:', error);
          return throwError(() => error);
        })
      );
  }
}