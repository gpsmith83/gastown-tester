import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  PersonaProgressionHistory,
  CreatePersonaProgressionRequest,
  PersonaProgressionSession,
  PersonaProgressionAnalytics,
  SpecialistUsageStats
} from '../models/workspace.model';

@Injectable({
  providedIn: 'root'
})
export class PersonaProgressionService {
  private readonly API_BASE = 'http://localhost:3000/api/persona-progression';

  constructor(private http: HttpClient) {}

  /**
   * Create a new persona progression record
   */
  createProgressionRecord(data: CreatePersonaProgressionRequest): Observable<PersonaProgressionHistory> {
    return this.http.post<PersonaProgressionHistory>(this.API_BASE, data, { withCredentials: true })
      .pipe(
        catchError(error => {
          console.error('Failed to create progression record:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get progression record by ID
   */
  getProgressionRecord(id: string): Observable<PersonaProgressionHistory> {
    return this.http.get<PersonaProgressionHistory>(`${this.API_BASE}/${id}`, { withCredentials: true })
      .pipe(
        catchError(error => {
          console.error('Failed to get progression record:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Update progression record
   */
  updateProgressionRecord(id: string, data: Partial<CreatePersonaProgressionRequest>): Observable<PersonaProgressionHistory> {
    return this.http.put<PersonaProgressionHistory>(`${this.API_BASE}/${id}`, data, { withCredentials: true })
      .pipe(
        catchError(error => {
          console.error('Failed to update progression record:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get progression history for a specific session
   */
  getSessionHistory(sessionId: string): Observable<PersonaProgressionHistory[]> {
    return this.http.get<PersonaProgressionHistory[]>(`${this.API_BASE}/session/${sessionId}`, { withCredentials: true })
      .pipe(
        catchError(error => {
          console.error('Failed to get session history:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get progression history for a project
   */
  getProjectHistory(projectId: string): Observable<PersonaProgressionHistory[]> {
    return this.http.get<PersonaProgressionHistory[]>(`${this.API_BASE}/project/${projectId}`, { withCredentials: true })
      .pipe(
        catchError(error => {
          console.error('Failed to get project history:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get current session state for user in project
   */
  getCurrentSession(projectId: string, sessionId?: string): Observable<PersonaProgressionSession> {
    const params = sessionId ? `?session_id=${sessionId}` : '';
    return this.http.get<PersonaProgressionSession>(`${this.API_BASE}/project/${projectId}/current-session${params}`, { withCredentials: true })
      .pipe(
        catchError(error => {
          console.error('Failed to get current session:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get specialist usage history for a project
   */
  getSpecialistHistory(projectId: string, limit = 50): Observable<SpecialistUsageStats[]> {
    return this.http.get<SpecialistUsageStats[]>(`${this.API_BASE}/project/${projectId}/specialists?limit=${limit}`, { withCredentials: true })
      .pipe(
        catchError(error => {
          console.error('Failed to get specialist history:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get stage analytics for a project
   */
  getStageAnalytics(projectId: string): Observable<Array<{
    stage: string;
    completion_rate: number;
    average_score: number;
    average_duration_minutes: number;
  }>> {
    return this.http.get<Array<{
      stage: string;
      completion_rate: number;
      average_score: number;
      average_duration_minutes: number;
    }>>(`${this.API_BASE}/project/${projectId}/stages`, { withCredentials: true })
      .pipe(
        catchError(error => {
          console.error('Failed to get stage analytics:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get comprehensive analytics for a project
   */
  getProjectAnalytics(projectId: string): Observable<PersonaProgressionAnalytics> {
    return this.http.get<PersonaProgressionAnalytics>(`${this.API_BASE}/project/${projectId}/analytics`, { withCredentials: true })
      .pipe(
        catchError(error => {
          console.error('Failed to get project analytics:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Generate a new session ID
   */
  generateSessionId(): Observable<{ session_id: string }> {
    return this.http.post<{ session_id: string }>(`${this.API_BASE}/generate-session`, {}, { withCredentials: true })
      .pipe(
        catchError(error => {
          console.error('Failed to generate session ID:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Delete progression records for a session (cleanup)
   */
  deleteSession(sessionId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_BASE}/session/${sessionId}`, { withCredentials: true })
      .pipe(
        catchError(error => {
          console.error('Failed to delete session:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Helper method to track specialist selection
   */
  trackSpecialistSelection(
    projectId: string,
    sessionId: string,
    specialist: string,
    reason?: string,
    previousSpecialists?: string[]
  ): Observable<PersonaProgressionHistory> {
    const data: CreatePersonaProgressionRequest = {
      project_id: projectId,
      session_id: sessionId,
      session_type: 'selection',
      specialist_selected: specialist,
      specialist_reason: reason,
      previous_specialists: previousSpecialists,
      refinement_stage: 'specialist_selection'
    };

    return this.createProgressionRecord(data);
  }

  /**
   * Helper method to track refinement outcome
   */
  trackRefinementOutcome(
    projectId: string,
    sessionId: string,
    stage: string,
    outcome: 'completed' | 'in_progress' | 'abandoned' | 'escalated',
    outcomeData?: any,
    score?: number,
    timeSpentMinutes?: number
  ): Observable<PersonaProgressionHistory> {
    const data: CreatePersonaProgressionRequest = {
      project_id: projectId,
      session_id: sessionId,
      session_type: 'refinement',
      refinement_stage: stage,
      refinement_outcome: outcome,
      outcome_data: outcomeData,
      progression_score: score,
      time_spent_minutes: timeSpentMinutes
    };

    return this.createProgressionRecord(data);
  }

  /**
   * Helper method to update persona stack for a session
   */
  updatePersonaStack(
    progressionId: string,
    personaStack: any,
    progressionContext?: any
  ): Observable<PersonaProgressionHistory> {
    const data = {
      current_persona_stack: personaStack,
      progression_context: progressionContext
    };

    return this.updateProgressionRecord(progressionId, data);
  }
}