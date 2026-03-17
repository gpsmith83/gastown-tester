import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { RequirementService } from '../services/requirement.service';
import { RefinementService } from '../services/refinement.service';
import { RequirementWithDetails } from '../models/requirement.model';
import { RefinementSessionWithDetails } from '../models/refinement.model';

@Component({
  selector: 'app-requirement',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './requirement.component.html',
  styleUrl: './requirement.component.css'
})
export class RequirementComponent implements OnInit, OnDestroy {
  requirement: RequirementWithDetails | null = null;
  refinementSessions: RefinementSessionWithDetails[] = [];
  isLoading = false;
  isLoadingSessions = false;
  error = '';

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private requirementService: RequirementService,
    private refinementService: RefinementService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.loadRequirement(id);
        this.loadRefinementSessions(id);
      }
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private loadRequirement(id: string) {
    this.isLoading = true;
    this.error = '';

    this.requirementService.getRequirement(id).subscribe({
      next: (requirement) => {
        this.requirement = requirement;
        this.isLoading = false;
      },
      error: (error) => {
        this.error = 'Failed to load requirement: ' + (error.error?.message || error.message);
        this.isLoading = false;
      }
    });
  }

  private loadRefinementSessions(requirementId: string) {
    this.isLoadingSessions = true;

    this.refinementService.getRequirementSessions(requirementId).subscribe({
      next: (sessions) => {
        this.refinementSessions = sessions;
        this.isLoadingSessions = false;
      },
      error: (error) => {
        console.error('Failed to load refinement sessions:', error);
        this.isLoadingSessions = false;
      }
    });
  }

  public reloadRequirement() {
    if (this.requirement?.id) {
      this.loadRequirement(this.requirement.id);
    }
  }

  startRefinement() {
    if (this.requirement?.id) {
      this.router.navigate(['/refinement'], {
        queryParams: { requirementId: this.requirement.id }
      });
    }
  }

  openRefinementSession(sessionId: string) {
    this.router.navigate(['/refinement', sessionId]);
  }

  get readinessStatusLabel(): string {
    if (!this.requirement) return 'Unknown';

    switch (this.requirement.status) {
      case 'draft': return 'Draft';
      case 'active': return 'Active';
      case 'completed': return 'Completed';
      case 'archived': return 'Archived';
      default: return 'Unknown';
    }
  }

  getPriorityLabel(priority: number): string {
    switch (priority) {
      case 1: return 'Highest';
      case 2: return 'High';
      case 3: return 'Medium';
      case 4: return 'Low';
      case 5: return 'Lowest';
      default: return 'Unknown';
    }
  }

  getSessionStatusLabel(status: string): string {
    switch (status) {
      case 'active': return 'Active';
      case 'completed': return 'Completed';
      case 'paused': return 'Paused';
      case 'cancelled': return 'Cancelled';
      default: return 'Unknown';
    }
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString();
  }

  formatDateTime(date: Date): string {
    return new Date(date).toLocaleString();
  }
}
