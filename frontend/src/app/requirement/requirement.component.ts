import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { RequirementService } from '../services/requirement.service';
import {
  RequirementDetailState,
  RequirementWithDetails,
  ConversationSection,
  SummarySection,
  ReadinessSection
} from '../models/requirement.model';

@Component({
  selector: 'app-requirement',
  imports: [CommonModule],
  templateUrl: './requirement.component.html',
  styleUrl: './requirement.component.css'
})
export class RequirementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  state: RequirementDetailState = {
    requirement: null,
    loading: false,
    error: null
  };

  // Section data for the requirement detail page
  conversationSection: ConversationSection = {
    title: 'Conversation History',
    placeholder: 'No conversation started yet. Start refining this requirement to see the conversation history appear here.',
    isEmpty: true
  };

  summarySection: SummarySection = {
    title: 'Requirement Summary',
    placeholder: 'The refined summary of this requirement will appear here as you work through the refinement process.',
    isEmpty: true
  };

  readinessSection: ReadinessSection = {
    title: 'Readiness Status',
    placeholder: 'Readiness assessment will be shown here once refinement begins.',
    status: 'not_started'
  };

  constructor(
    private route: ActivatedRoute,
    private requirementService: RequirementService
  ) {}

  ngOnInit(): void {
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const requirementId = params['id'];
        if (requirementId) {
          this.loadRequirement(requirementId);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadRequirement(id: string): void {
    this.state.loading = true;
    this.state.error = null;

    this.requirementService.getRequirement(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (requirement: RequirementWithDetails) => {
          this.state.requirement = requirement;
          this.state.loading = false;
          this.updateSectionStates();
        },
        error: (error) => {
          console.error('Failed to load requirement:', error);
          this.state.error = 'Failed to load requirement details. Please try again.';
          this.state.loading = false;
        }
      });
  }

  private updateSectionStates(): void {
    // Update readiness status based on requirement status
    if (this.state.requirement) {
      switch (this.state.requirement.status) {
        case 'draft':
          this.readinessSection.status = 'not_started';
          break;
        case 'active':
          this.readinessSection.status = 'in_progress';
          break;
        case 'completed':
          this.readinessSection.status = 'completed';
          break;
        case 'archived':
          this.readinessSection.status = 'ready';
          break;
      }
    }
  }

  get priorityLabel(): string {
    if (!this.state.requirement) return '';
    const priority = this.state.requirement.priority;
    const labels = ['', 'Critical', 'High', 'Medium', 'Low', 'Minor'];
    return labels[priority] || 'Unknown';
  }

  get statusBadgeClass(): string {
    if (!this.state.requirement) return 'status-unknown';
    return `status-${this.state.requirement.status}`;
  }

  get typeBadgeClass(): string {
    if (!this.state.requirement) return 'type-unknown';
    return `type-${this.state.requirement.type}`;
  }

  get readinessStatusClass(): string {
    return `readiness-${this.readinessSection.status}`;
  }

  get readinessStatusLabel(): string {
    return this.readinessSection.status.replace('_', ' ');
  }

  startRefinement(): void {
    // TODO: Implement refinement session start logic
    console.log('Starting refinement for requirement:', this.state.requirement?.id);
  }
}
