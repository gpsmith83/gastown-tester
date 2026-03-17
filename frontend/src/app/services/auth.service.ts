import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { AuthStatus, LoginResponse, LogoutResponse } from '../models/auth.model';
import { User } from '../models/workspace.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_BASE = 'http://localhost:3000';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);

  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private http: HttpClient) {
    // Check authentication status on service initialization
    this.checkAuthStatus().subscribe();
  }

  /**
   * Check current authentication status
   */
  checkAuthStatus(): Observable<AuthStatus> {
    return this.http.get<AuthStatus>(`${this.API_BASE}/auth/status`, { withCredentials: true })
      .pipe(
        tap(response => {
          this.currentUserSubject.next(response.user);
          this.isAuthenticatedSubject.next(response.authenticated);
        }),
        catchError(error => {
          console.error('Auth status check failed:', error);
          this.currentUserSubject.next(null);
          this.isAuthenticatedSubject.next(false);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get current user information
   */
  getCurrentUser(): Observable<AuthStatus> {
    return this.http.get<AuthStatus>(`${this.API_BASE}/auth/me`, { withCredentials: true })
      .pipe(
        tap(response => {
          this.currentUserSubject.next(response.user);
          this.isAuthenticatedSubject.next(response.authenticated);
        }),
        catchError(error => {
          console.error('Get current user failed:', error);
          this.currentUserSubject.next(null);
          this.isAuthenticatedSubject.next(false);
          return throwError(() => error);
        })
      );
  }

  /**
   * Start GitHub OAuth login flow
   */
  loginWithGitHub(): void {
    // Redirect to GitHub OAuth endpoint
    window.location.href = `${this.API_BASE}/auth/github`;
  }

  /**
   * Log out the current user
   */
  logout(): Observable<LogoutResponse> {
    return this.http.post<LogoutResponse>(`${this.API_BASE}/auth/logout`, {}, { withCredentials: true })
      .pipe(
        tap(response => {
          this.currentUserSubject.next(null);
          this.isAuthenticatedSubject.next(false);
        }),
        catchError(error => {
          console.error('Logout failed:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get current user (synchronous)
   */
  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Check if user is authenticated (synchronous)
   */
  get isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }
}