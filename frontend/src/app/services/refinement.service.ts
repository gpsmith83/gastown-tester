import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  RefinementSession,
  RefinementSessionWithDetails,
  RequirementMessage,
  RequirementMessageWithDetails,
  RefinementSummary,
  RequirementReadiness,
  RequirementReadinessWithDetails,
  ProjectReadinessStats,
  ReadinessGateResult,
  ReadinessGateRules,
  ReadinessGateOverride,
  ReadinessGateOverrideWithDetails,
  CreateReadinessGateOverrideRequest,
  ProjectGateResults,
  StartRefinementRequest,
  StartRefinementResponse,
  CreateMessageRequest,
  CreateMessageResponse
} from '../models/refinement.model';

@Injectable({
  providedIn: 'root'
})
export class RefinementService {
  private apiUrl = 'http://localhost:3000/api/refinement-sessions';

  // Active session state
  private _activeSession = new BehaviorSubject<RefinementSessionWithDetails | null>(null);
  private _messages = new BehaviorSubject<RequirementMessageWithDetails[]>([]);

  // Observable for components to subscribe to
  public activeSession$ = this._activeSession.asObservable();
  public messages$ = this._messages.asObservable();

  constructor(private http: HttpClient) {}

  // Start a new refinement session
  startRefinementSession(data: StartRefinementRequest): Observable<StartRefinementResponse> {
    return this.http.post<StartRefinementResponse>(`${this.apiUrl}/start`, data, { withCredentials: true })
      .pipe(
        map(response => {
          // Set active session and initial message
          this._activeSession.next(response.session);
          this._messages.next([response.first_question]);
          return response;
        })
      );
  }

  // Get refinement session by ID
  getRefinementSession(sessionId: string): Observable<RefinementSessionWithDetails> {
    return this.http.get<{ session: RefinementSessionWithDetails }>(`${this.apiUrl}/${sessionId}`, { withCredentials: true })
      .pipe(
        map(response => {
          this._activeSession.next(response.session);
          return response.session;
        })
      );
  }

  // Get messages for a refinement session
  getSessionMessages(sessionId: string): Observable<RequirementMessageWithDetails[]> {
    return this.http.get<{ messages: RequirementMessageWithDetails[], total: number }>(`${this.apiUrl}/${sessionId}/messages`, { withCredentials: true })
      .pipe(
        map(response => {
          this._messages.next(response.messages);
          return response.messages;
        })
      );
  }

  // Send a message and get AI response
  sendMessage(sessionId: string, data: CreateMessageRequest): Observable<CreateMessageResponse> {
    return this.http.post<CreateMessageResponse>(`${this.apiUrl}/${sessionId}/messages`, data, { withCredentials: true })
      .pipe(
        map(response => {
          // Update messages list with new user message and AI response
          const currentMessages = this._messages.value;
          const newMessages = [response.userMessage];

          if (response.aiResponse) {
            newMessages.push(response.aiResponse);
          }

          this._messages.next([...currentMessages, ...newMessages]);
          return response;
        })
      );
  }

  // Get refinement sessions for a requirement
  getRequirementSessions(requirementId: string): Observable<RefinementSessionWithDetails[]> {
    return this.http.get<{ sessions: RefinementSessionWithDetails[], total: number }>(`${this.apiUrl}/requirement/${requirementId}`, { withCredentials: true })
      .pipe(
        map(response => response.sessions)
      );
  }

  // Load existing session with conversation history
  loadSession(sessionId: string): Observable<{ session: RefinementSessionWithDetails, messages: RequirementMessageWithDetails[] }> {
    return new Observable(observer => {
      // Load session details and messages in parallel
      Promise.all([
        this.getRefinementSession(sessionId).toPromise(),
        this.getSessionMessages(sessionId).toPromise()
      ]).then(([session, messages]) => {
        observer.next({ session: session!, messages: messages! });
        observer.complete();
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  // Clear active session and messages
  clearActiveSession(): void {
    this._activeSession.next(null);
    this._messages.next([]);
  }

  // Get current active session (synchronous)
  getCurrentSession(): RefinementSessionWithDetails | null {
    return this._activeSession.value;
  }

  // Get current messages (synchronous)
  getCurrentMessages(): RequirementMessageWithDetails[] {
    return this._messages.value;
  }

  // Summary-related methods (B-204)

  // Get summaries for a refinement session
  getSessionSummaries(sessionId: string): Observable<RefinementSummary[]> {
    return this.http.get<{ summaries: RefinementSummary[], total: number }>(`${this.apiUrl}/${sessionId}/summaries`, { withCredentials: true })
      .pipe(
        map(response => response.summaries)
      );
  }

  // Get latest summary for a refinement session
  getLatestSessionSummary(sessionId: string): Observable<RefinementSummary | null> {
    return this.http.get<{ summary: RefinementSummary }>(`${this.apiUrl}/${sessionId}/summary/latest`, { withCredentials: true })
      .pipe(
        map(response => response.summary)
      );
  }

  // Generate a new summary for a session (manual trigger)
  generateSessionSummary(sessionId: string, summaryType?: 'conversation_progress' | 'final_summary' | 'milestone'): Observable<RefinementSummary> {
    return this.http.post<{ summary: RefinementSummary }>(`${this.apiUrl}/${sessionId}/summary/generate`,
      { summary_type: summaryType },
      { withCredentials: true })
      .pipe(
        map(response => response.summary)
      );
  }

  // Get summaries for a requirement (across all sessions)
  getRequirementSummaries(requirementId: string): Observable<RefinementSummary[]> {
    return this.http.get<{ summaries: RefinementSummary[], total: number }>(`http://localhost:3000/api/requirements/${requirementId}/summaries`, { withCredentials: true })
      .pipe(
        map(response => response.summaries)
      );
  }

  // Get latest summary for a requirement
  getLatestRequirementSummary(requirementId: string): Observable<RefinementSummary | null> {
    return this.http.get<{ summary: RefinementSummary }>(`http://localhost:3000/api/requirements/${requirementId}/summary/latest`, { withCredentials: true })
      .pipe(
        map(response => response.summary)
      );
  }

  // Readiness-related methods (B-205)

  // Get readiness for a requirement
  getRequirementReadiness(requirementId: string): Observable<RequirementReadinessWithDetails | null> {
    return this.http.get<{ readiness: RequirementReadinessWithDetails }>(`http://localhost:3000/api/requirements/${requirementId}/readiness`, { withCredentials: true })
      .pipe(
        map(response => response.readiness)
      );
  }

  // Analyze/compute readiness for a requirement
  analyzeRequirementReadiness(requirementId: string, forceRecompute?: boolean): Observable<RequirementReadinessWithDetails> {
    return this.http.post<{ readiness: RequirementReadinessWithDetails }>(`http://localhost:3000/api/requirements/${requirementId}/readiness/analyze`,
      { force_recompute: forceRecompute },
      { withCredentials: true })
      .pipe(
        map(response => response.readiness)
      );
  }

  // Get project readiness statistics
  getProjectReadinessStats(projectId: string): Observable<ProjectReadinessStats> {
    return this.http.get<{ readiness_stats: ProjectReadinessStats }>(`http://localhost:3000/api/projects/${projectId}/readiness/stats`, { withCredentials: true })
      .pipe(
        map(response => response.readiness_stats)
      );
  }

  // Analyze readiness for all requirements in a project
  analyzeProjectReadiness(projectId: string, forceRecompute?: boolean): Observable<{ analyzed_count: number; readiness_stats: ProjectReadinessStats }> {
    return this.http.post<{ analyzed_count: number; readiness_stats: ProjectReadinessStats }>(`http://localhost:3000/api/projects/${projectId}/readiness/analyze`,
      { force_recompute: forceRecompute },
      { withCredentials: true })
      .pipe(
        map(response => ({ analyzed_count: response.analyzed_count, readiness_stats: response.readiness_stats }))
      );
  }

  // Readiness gate methods (B-305)

  // Check readiness gate for a requirement
  checkRequirementGate(requirementId: string, includeOverrideDetails?: boolean): Observable<ReadinessGateResult> {
    let url = `http://localhost:3000/api/requirements/${requirementId}/gate`;
    if (includeOverrideDetails) {
      url += '?include_override_details=true';
    }
    return this.http.get<{ gate_result: ReadinessGateResult }>(url, { withCredentials: true })
      .pipe(
        map(response => response.gate_result)
      );
  }

  // Create readiness gate override
  createGateOverride(requirementId: string, data: CreateReadinessGateOverrideRequest): Observable<ReadinessGateOverrideWithDetails> {
    return this.http.post<{ override: ReadinessGateOverrideWithDetails }>(`http://localhost:3000/api/requirements/${requirementId}/gate/override`,
      data,
      { withCredentials: true })
      .pipe(
        map(response => response.override)
      );
  }

  // Get overrides for a requirement
  getRequirementGateOverrides(requirementId: string): Observable<ReadinessGateOverride[]> {
    return this.http.get<{ overrides: ReadinessGateOverride[], total: number }>(`http://localhost:3000/api/requirements/${requirementId}/gate/overrides`, { withCredentials: true })
      .pipe(
        map(response => response.overrides)
      );
  }

  // Revoke readiness gate override
  revokeGateOverride(requirementId: string, overrideId: string): Observable<void> {
    return this.http.delete<void>(`http://localhost:3000/api/requirements/${requirementId}/gate/override/${overrideId}`, { withCredentials: true });
  }

  // Check readiness gates for all requirements in a project
  checkProjectGates(projectId: string, includeOverrideDetails?: boolean): Observable<ProjectGateResults> {
    let url = `http://localhost:3000/api/projects/${projectId}/gate/check`;
    if (includeOverrideDetails) {
      url += '?include_override_details=true';
    }
    return this.http.get<ProjectGateResults>(url, { withCredentials: true });
  }

  // Get gate rules for a project
  getGateRules(projectId: string): Observable<{ gate_rules: ReadinessGateRules; description: any }> {
    return this.http.get<{ gate_rules: ReadinessGateRules; description: any }>(`http://localhost:3000/api/projects/${projectId}/gate/rules`, { withCredentials: true });
  }
}