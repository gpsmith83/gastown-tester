import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Requirement,
  RequirementWithDetails,
  CreateRequirementRequest,
  RequirementsResponse,
  RequirementResponse
} from '../models/requirement.model';

@Injectable({
  providedIn: 'root'
})
export class RequirementService {
  private apiUrl = 'http://localhost:3000/api/requirements';
  private _requirements = new BehaviorSubject<RequirementWithDetails[]>([]);

  // Observable for components to subscribe to requirement list changes
  public requirements$ = this._requirements.asObservable();

  constructor(private http: HttpClient) {}

  // Get all requirements for the current user
  getRequirements(): Observable<RequirementWithDetails[]> {
    return this.http.get<RequirementsResponse>(this.apiUrl, { withCredentials: true })
      .pipe(
        map(response => {
          this._requirements.next(response.requirements);
          return response.requirements;
        })
      );
  }

  // Get requirements for a specific project
  getProjectRequirements(projectId: string): Observable<RequirementWithDetails[]> {
    return this.http.get<RequirementsResponse>(`${this.apiUrl}/project/${projectId}`, { withCredentials: true })
      .pipe(
        map(response => response.requirements)
      );
  }

  // Get a specific requirement by ID
  getRequirement(id: string): Observable<RequirementWithDetails> {
    return this.http.get<RequirementResponse>(`${this.apiUrl}/${id}`, { withCredentials: true })
      .pipe(
        map(response => response.requirement)
      );
  }

  // Create a new requirement
  createRequirement(data: CreateRequirementRequest): Observable<RequirementWithDetails> {
    return this.http.post<RequirementResponse>(this.apiUrl, data, { withCredentials: true })
      .pipe(
        map(response => {
          // Add the new requirement to the current list
          const currentRequirements = this._requirements.value;
          this._requirements.next([response.requirement, ...currentRequirements]);
          return response.requirement;
        })
      );
  }

  // Update a requirement
  updateRequirement(id: string, data: Partial<CreateRequirementRequest>): Observable<RequirementWithDetails> {
    return this.http.put<RequirementResponse>(`${this.apiUrl}/${id}`, data, { withCredentials: true })
      .pipe(
        map(response => {
          // Update the requirement in the current list
          const currentRequirements = this._requirements.value;
          const updatedRequirements = currentRequirements.map(req =>
            req.id === id ? response.requirement : req
          );
          this._requirements.next(updatedRequirements);
          return response.requirement;
        })
      );
  }

  // Update requirement status
  updateRequirementStatus(id: string, status: 'draft' | 'active' | 'completed' | 'archived'): Observable<Requirement> {
    return this.http.patch<{ requirement: Requirement }>(`${this.apiUrl}/${id}/status`, { status }, { withCredentials: true })
      .pipe(
        map(response => response.requirement)
      );
  }

  // Delete a requirement (soft delete)
  deleteRequirement(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { withCredentials: true })
      .pipe(
        map(() => {
          // Remove the requirement from the current list
          const currentRequirements = this._requirements.value;
          const filteredRequirements = currentRequirements.filter(req => req.id !== id);
          this._requirements.next(filteredRequirements);
        })
      );
  }

  // Helper method to create requirement from form data
  createRequirementFromForm(projectId: string, formData: { prompt: string; contextNotes?: string }): Observable<RequirementWithDetails> {
    const createRequest: CreateRequirementRequest = {
      title: formData.prompt,
      description: formData.contextNotes,
      project_id: projectId,
      priority: 3, // Default medium priority
      type: 'feature' // Default to feature type
    };

    return this.createRequirement(createRequest);
  }

  // Clear the requirements cache (useful for component cleanup)
  clearRequirements(): void {
    this._requirements.next([]);
  }
}