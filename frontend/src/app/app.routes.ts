import { Routes } from '@angular/router';
import { SigninComponent } from './signin/signin.component';
import { WorkspaceComponent } from './workspace/workspace.component';
import { ProjectComponent } from './project/project.component';
import { RequirementComponent } from './requirement/requirement.component';

export const routes: Routes = [
  { path: '', redirectTo: '/signin', pathMatch: 'full' },
  { path: 'signin', component: SigninComponent },
  { path: 'workspace', component: WorkspaceComponent },
  { path: 'project', component: ProjectComponent },
  { path: 'requirement', component: RequirementComponent },
  { path: '**', redirectTo: '/signin' }
];
