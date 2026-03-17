import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import {
  Requirement,
  RequirementWithDetails,
  CreateRequirementRequest,
  RequirementsResponse,
  RequirementResponse,
  ApiResponse
} from '../models/requirement.model';

@Injectable({
  providedIn: 'root'
})
export class RequirementService {
  private readonly API_BASE = 'http://localhost:3000/api/requirements';
  private _requirements = new BehaviorSubject<RequirementWithDetails[]>([]);

  // Observable for components to subscribe to requirement list changes
  public requirements$ = this._requirements.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get all requirements accessible to the current user
   */
  getAllRequirements(): Observable<RequirementWithDetails[]> {
    return this.http.get<RequirementsResponse>(this.API_BASE, { withCredentials: true })
      .pipe(
        map(response => {
          this._requirements.next(response.requirements);
          return response.requirements;
        }),
        catchError(error => {
          console.error('Failed to fetch requirements:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get all requirements for a specific project
   */
  getProjectRequirements(projectId: string): Observable<RequirementWithDetails[]> {
    return this.http.get<RequirementsResponse>(`${this.API_BASE}/project/${projectId}`, { withCredentials: true })
      .pipe(
        map(response => response.requirements),
        catchError(error => {
          console.error('Failed to fetch project requirements:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get a specific requirement by ID
   */
  getRequirement(id: string): Observable<RequirementWithDetails> {
    return this.http.get<RequirementResponse>(`${this.API_BASE}/${id}`, { withCredentials: true })
      .pipe(
        map(response => response.requirement),
        catchError(error => {
          console.error('Failed to fetch requirement:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Create a new requirement
   */
  createRequirement(data: CreateRequirementRequest): Observable<RequirementWithDetails> {
    return this.http.post<RequirementResponse>(this.API_BASE, data, { withCredentials: true })
      .pipe(
        map(response => {
          // Add the new requirement to the current list
          const currentRequirements = this._requirements.value;
          this._requirements.next([response.requirement, ...currentRequirements]);
          return response.requirement;
        }),
        catchError(error => {
          console.error('Failed to create requirement:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Update an existing requirement
   */
  updateRequirement(id: string, data: Partial<CreateRequirementRequest>): Observable<RequirementWithDetails> {
    return this.http.put<RequirementResponse>(`${this.API_BASE}/${id}`, data, { withCredentials: true })
      .pipe(
        map(response => {
          // Update the requirement in the current list
          const currentRequirements = this._requirements.value;
          const updatedRequirements = currentRequirements.map(req =>
            req.id === id ? response.requirement : req
          );
          this._requirements.next(updatedRequirements);
          return response.requirement;
        }),
        catchError(error => {
          console.error('Failed to update requirement:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Delete a requirement
   */
  deleteRequirement(id: string): Observable<boolean> {
    return this.http.delete<ApiResponse<any>>(`${this.API_BASE}/${id}`, { withCredentials: true })
      .pipe(
        map(response => {
          // Remove the requirement from the current list
          const currentRequirements = this._requirements.value;
          const filteredRequirements = currentRequirements.filter(req => req.id !== id);
          this._requirements.next(filteredRequirements);
          return true;
        }),
        catchError(error => {
          console.error('Failed to delete requirement:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Search requirements by text
   */
  searchRequirements(query: string): Observable<RequirementWithDetails[]> {
    return this.http.get<RequirementsResponse>(`${this.API_BASE}/search`, {
      params: { q: query },
      withCredentials: true
    })
      .pipe(
        map(response => response.requirements),
        catchError(error => {
          console.error('Failed to search requirements:', error);
          return throwError(() => error);
        })
      );
  }
}