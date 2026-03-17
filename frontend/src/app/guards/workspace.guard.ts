import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { ProjectService } from '../services/project.service';
import { WorkspaceService } from '../services/workspace.service';

/**
 * Guard that ensures users can only access resources within their authorized workspaces
 */
@Injectable({
  providedIn: 'root'
})
export class WorkspaceGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private projectService: ProjectService,
    private workspaceService: WorkspaceService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Check if user is authenticated first
    if (!this.authService.currentUser) {
      this.router.navigate(['/signin']);
      return of(false);
    }

    // Extract resource IDs from route parameters or query params
    const projectId = route.params['projectId'] || route.queryParams['id'];
    const workspaceId = route.params['workspaceId'] || route.queryParams['workspaceId'];
    const requirementId = route.params['requirementId'] || route.queryParams['id'];

    // If accessing project-related route, verify project access
    if (projectId) {
      return this.verifyProjectAccess(projectId);
    }

    // If accessing workspace-related route, verify workspace access
    if (workspaceId) {
      return this.verifyWorkspaceAccess(workspaceId);
    }

    // If accessing requirement-related route, verify requirement access
    if (requirementId && route.url.some(segment => segment.path.includes('requirement'))) {
      return this.verifyRequirementAccess(requirementId);
    }

    // For routes without specific resource IDs, allow access
    return of(true);
  }

  private verifyProjectAccess(projectId: string): Observable<boolean> {
    return this.projectService.getProject(projectId).pipe(
      map(() => true), // If request succeeds, user has access
      catchError((error) => {
        console.warn('[WORKSPACE_GUARD] Project access denied:', error);
        this.router.navigate(['/workspace']);
        return of(false);
      })
    );
  }

  private verifyWorkspaceAccess(workspaceId: string): Observable<boolean> {
    return this.workspaceService.getWorkspace(workspaceId).pipe(
      map(() => true), // If request succeeds, user has access
      catchError((error) => {
        console.warn('[WORKSPACE_GUARD] Workspace access denied:', error);
        this.router.navigate(['/workspace']);
        return of(false);
      })
    );
  }

  private verifyRequirementAccess(requirementId: string): Observable<boolean> {
    // For requirement access, we need to check if user has access to the requirement
    // This will be handled by the backend API - if the user doesn't have access,
    // the API will return 403 and we'll redirect
    return of(true).pipe(
      switchMap(() => {
        // We could make an API call here to verify requirement access,
        // but it's more efficient to let the component handle the API call
        // and handle the 403 response there. For now, we'll allow navigation
        // and let the component enforce the access control.
        return of(true);
      })
    );
  }
}