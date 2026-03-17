import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  Project,
  ProjectWithDetails,
  CreateProjectRequest,
  ProjectsResponse
} from '../models/workspace.model';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private readonly API_BASE = 'http://localhost:3000/api/projects';

  constructor(private http: HttpClient) {}

  /**
   * Get all projects for the current user (across all workspaces)
   */
  getProjects(): Observable<ProjectWithDetails[]> {
    return this.http.get<ProjectsResponse>(this.API_BASE, { withCredentials: true })
      .pipe(
        map(response => response.projects),
        catchError(error => {
          console.error('Failed to fetch projects:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get projects in a specific workspace
   */
  getProjectsByWorkspace(workspaceId: string): Observable<Project[]> {
    return this.http.get<{ projects: Project[]; total: number }>(
      `${this.API_BASE}/workspace/${workspaceId}`,
      { withCredentials: true }
    ).pipe(
      map(response => response.projects),
      catchError(error => {
        console.error('Failed to fetch workspace projects:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get a specific project by ID
   */
  getProject(id: string): Observable<ProjectWithDetails> {
    return this.http.get<{ project: ProjectWithDetails }>(`${this.API_BASE}/${id}`, { withCredentials: true })
      .pipe(
        map(response => response.project),
        catchError(error => {
          console.error('Failed to fetch project:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Create a new project
   */
  createProject(project: CreateProjectRequest): Observable<ProjectWithDetails> {
    return this.http.post<{ project: ProjectWithDetails; message: string }>(
      this.API_BASE,
      project,
      { withCredentials: true }
    ).pipe(
      map(response => response.project),
      catchError(error => {
        console.error('Failed to create project:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update an existing project
   */
  updateProject(id: string, updates: Partial<CreateProjectRequest>): Observable<ProjectWithDetails> {
    return this.http.put<{ project: ProjectWithDetails; message: string }>(
      `${this.API_BASE}/${id}`,
      updates,
      { withCredentials: true }
    ).pipe(
      map(response => response.project),
      catchError(error => {
        console.error('Failed to update project:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update project status
   */
  updateProjectStatus(id: string, status: 'active' | 'archived' | 'draft'): Observable<Project> {
    return this.http.patch<{ project: Project; message: string }>(
      `${this.API_BASE}/${id}/status`,
      { status },
      { withCredentials: true }
    ).pipe(
      map(response => response.project),
      catchError(error => {
        console.error('Failed to update project status:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete a project (soft delete)
   */
  deleteProject(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_BASE}/${id}`, { withCredentials: true })
      .pipe(
        catchError(error => {
          console.error('Failed to delete project:', error);
          return throwError(() => error);
        })
      );
  }
}