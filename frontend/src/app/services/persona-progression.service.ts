import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  ReadinessGateOverride,
  CreateReadinessGateOverrideRequest,
  ApiResponse
} from '../models/requirement.model';

@Injectable({
  providedIn: 'root'
})
export class PersonaProgressionService {
  private readonly apiUrl = 'http://localhost:3000/api/persona-progression';

  constructor(private http: HttpClient) {}

  // Readiness Gate Override methods

  // Get all overrides for a requirement
  getReadinessOverrides(requirementId: string): Observable<{ overrides: ReadinessGateOverride[] }> {
    return this.http.get<{ overrides: ReadinessGateOverride[] }>(`${this.apiUrl}/readiness-overrides/requirement/${requirementId}`)
      .pipe(catchError(this.handleError));
  }

  // Get specific override for requirement and dimension
  getReadinessOverride(requirementId: string, dimensionId: string): Observable<{ override: ReadinessGateOverride | null }> {
    return this.http.get<{ override: ReadinessGateOverride | null }>(`${this.apiUrl}/readiness-overrides/requirement/${requirementId}/dimension/${dimensionId}`)
      .pipe(catchError(this.handleError));
  }

  // Create a new readiness gate override
  createReadinessOverride(data: CreateReadinessGateOverrideRequest): Observable<{ override: ReadinessGateOverride; message: string }> {
    return this.http.post<{ override: ReadinessGateOverride; message: string }>(`${this.apiUrl}/readiness-overrides`, data)
      .pipe(catchError(this.handleError));
  }

  // Update a readiness gate override
  updateReadinessOverride(
    overrideId: string,
    data: { override_reason?: string; override_score?: number; expires_at?: string; is_active?: boolean }
  ): Observable<{ override: ReadinessGateOverride; message: string }> {
    return this.http.put<{ override: ReadinessGateOverride; message: string }>(`${this.apiUrl}/readiness-overrides/${overrideId}`, data)
      .pipe(catchError(this.handleError));
  }

  // Delete a readiness gate override
  deleteReadinessOverride(overrideId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/readiness-overrides/${overrideId}`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      errorMessage = error.error?.error || error.error?.message || `HTTP ${error.status}: ${error.statusText}`;
    }

    console.error('PersonaProgressionService error:', error);
    return throwError(() => new Error(errorMessage));
  }
}