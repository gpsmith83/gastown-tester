import { Routes } from '@angular/router';
import { SigninComponent } from './signin/signin.component';
import { WorkspaceComponent } from './workspace/workspace.component';
import { ProjectComponent } from './project/project.component';
import { RequirementComponent } from './requirement/requirement.component';
import { WorkspaceGuard } from './guards/workspace.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/signin', pathMatch: 'full' },
  { path: 'signin', component: SigninComponent },
  {
    path: 'workspace',
    component: WorkspaceComponent,
    canActivate: [WorkspaceGuard]
  },
  {
    path: 'project',
    component: ProjectComponent,
    canActivate: [WorkspaceGuard]
  },
  {
    path: 'requirement/:id',
    component: RequirementComponent,
    canActivate: [WorkspaceGuard]
  },
  { path: '**', redirectTo: '/signin' }
];
