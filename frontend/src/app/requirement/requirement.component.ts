import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { RequirementService } from '../services/requirement.service';
import { PersonaProgressionService } from '../services/persona-progression.service';
import {
  RequirementDetailState,
  RequirementWithDetails,
  ConversationSection,
  SummarySection,
  ReadinessSection,
  ReadinessDimension,
  ReadinessDimensionStatus,
  ReadinessGateOverride,
  CreateReadinessGateOverrideRequest
} from '../models/requirement.model';

@Component({
  selector: 'app-requirement',
  imports: [CommonModule, FormsModule],
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
    status: 'not_started',
    dimensions: [],
    totalScore: 0,
    missingInformation: []
  };

  // B-307: Override UI state
  showOverrideModal = false;
  currentDimensionForOverride: ReadinessDimension | null = null;
  overrideReason = '';
  overrideScore = 100;
  isCreatingOverride = false;

  constructor(
    private route: ActivatedRoute,
    private requirementService: RequirementService,
    private personaProgressionService: PersonaProgressionService
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

    // Load requirement and readiness overrides in parallel
    forkJoin({
      requirement: this.requirementService.getRequirement(id),
      overrides: this.personaProgressionService.getReadinessOverrides(id)
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ requirement, overrides }) => {
          this.state.requirement = requirement;
          this.readinessSection.overrides = overrides.overrides;
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
      this.updateReadinessStatus();
      this.calculateReadinessDimensions();
      this.calculateTotalScore();
    }
  }

  private updateReadinessStatus(): void {
    if (!this.state.requirement) return;

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

  private calculateReadinessDimensions(): void {
    if (!this.state.requirement) return;

    const requirement = this.state.requirement;
    const dimensions: ReadinessDimension[] = [
      this.createTitleDimension(requirement),
      this.createDescriptionDimension(requirement),
      this.createProjectDimension(requirement),
      this.createPriorityDimension(requirement),
      this.createTypeDimension(requirement),
      this.createGitHubDimension(requirement)
    ];

    this.readinessSection.dimensions = dimensions;
  }

  private createTitleDimension(requirement: RequirementWithDetails): ReadinessDimension {
    const hasTitle = !!requirement.title && requirement.title.trim().length > 0;
    const isClear = hasTitle && requirement.title.length >= 10; // At least 10 characters for clarity

    let status: ReadinessDimensionStatus;
    let score: number;
    let missingItems: string[] = [];

    if (!hasTitle) {
      status = 'missing';
      score = 0;
      missingItems = ['Title is required'];
    } else if (!isClear) {
      status = 'partial';
      score = 50;
      missingItems = ['Title should be more descriptive (at least 10 characters)'];
    } else {
      status = 'complete';
      score = 100;
    }

    return {
      id: 'title',
      name: 'Title',
      description: 'Clear and descriptive requirement title',
      status,
      score,
      missingItems
    };
  }

  private createDescriptionDimension(requirement: RequirementWithDetails): ReadinessDimension {
    const hasDescription = !!requirement.description && requirement.description.trim().length > 0;
    const isDetailed = hasDescription && requirement.description!.length >= 50; // At least 50 characters for detail

    let status: ReadinessDimensionStatus;
    let score: number;
    let missingItems: string[] = [];

    if (!hasDescription) {
      status = 'missing';
      score = 0;
      missingItems = ['Description is required'];
    } else if (!isDetailed) {
      status = 'partial';
      score = 60;
      missingItems = ['Description should include more detail (at least 50 characters)'];
    } else {
      status = 'complete';
      score = 100;
    }

    return {
      id: 'description',
      name: 'Description',
      description: 'Detailed requirement description',
      status,
      score,
      missingItems
    };
  }

  private createProjectDimension(requirement: RequirementWithDetails): ReadinessDimension {
    const hasProject = !!requirement.project;

    return {
      id: 'project',
      name: 'Project',
      description: 'Associated project information',
      status: hasProject ? 'complete' : 'missing',
      score: hasProject ? 100 : 0,
      missingItems: hasProject ? [] : ['Project association is required']
    };
  }

  private createPriorityDimension(requirement: RequirementWithDetails): ReadinessDimension {
    const hasPriority = requirement.priority && requirement.priority >= 1 && requirement.priority <= 5;

    return {
      id: 'priority',
      name: 'Priority',
      description: 'Valid priority level (1-5)',
      status: hasPriority ? 'complete' : 'missing',
      score: hasPriority ? 100 : 0,
      missingItems: hasPriority ? [] : ['Valid priority (1-5) is required']
    };
  }

  private createTypeDimension(requirement: RequirementWithDetails): ReadinessDimension {
    const validTypes = ['feature', 'bug', 'enhancement', 'epic'];
    const hasValidType = validTypes.includes(requirement.type);

    return {
      id: 'type',
      name: 'Type',
      description: 'Valid requirement type',
      status: hasValidType ? 'complete' : 'missing',
      score: hasValidType ? 100 : 0,
      missingItems: hasValidType ? [] : ['Valid type (feature, bug, enhancement, epic) is required']
    };
  }

  private createGitHubDimension(requirement: RequirementWithDetails): ReadinessDimension {
    const hasGitHubIssue = !!requirement.github_issue_url;
    const hasIssueNumber = !!requirement.github_issue_number;

    let status: ReadinessDimensionStatus;
    let score: number;
    let missingItems: string[] = [];

    if (hasGitHubIssue && hasIssueNumber) {
      status = 'complete';
      score = 100;
    } else if (hasGitHubIssue || hasIssueNumber) {
      status = 'partial';
      score = 50;
      if (!hasGitHubIssue) missingItems.push('GitHub issue URL');
      if (!hasIssueNumber) missingItems.push('GitHub issue number');
    } else {
      status = 'missing';
      score = 0;
      missingItems = ['GitHub issue URL and number for tracking'];
    }

    return {
      id: 'github',
      name: 'GitHub Integration',
      description: 'GitHub issue for tracking',
      status,
      score,
      missingItems
    };
  }

  private calculateTotalScore(): void {
    if (this.readinessSection.dimensions.length === 0) {
      this.readinessSection.totalScore = 0;
      return;
    }

    const totalPossible = this.readinessSection.dimensions.length * 100;
    // Use effective scores (including overrides)
    const totalActual = this.readinessSection.dimensions.reduce((sum, dim) => sum + this.getEffectiveScore(dim), 0);
    this.readinessSection.totalScore = Math.round((totalActual / totalPossible) * 100);

    // Collect missing information, but exclude dimensions that have active overrides
    this.readinessSection.missingInformation = this.readinessSection.dimensions
      .filter(dim => !this.hasOverride(dim.id)) // Don't include missing info for overridden dimensions
      .flatMap(dim => dim.missingItems)
      .filter(item => item.length > 0);
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

  getDimensionStatusClass(dimension: ReadinessDimension): string {
    return `dimension-${dimension.status}`;
  }

  getDimensionStatusIcon(dimension: ReadinessDimension): string {
    switch (dimension.status) {
      case 'complete':
        return '✅';
      case 'partial':
        return '⚠️';
      case 'missing':
        return '❌';
      default:
        return '❓';
    }
  }

  getScoreProgressClass(): string {
    const score = this.readinessSection.totalScore;
    if (score >= 80) return 'score-excellent';
    if (score >= 60) return 'score-good';
    if (score >= 40) return 'score-fair';
    return 'score-poor';
  }

  getScoreProgressWidth(): string {
    return `${this.readinessSection.totalScore}%`;
  }

  get hasMissingInformation(): boolean {
    return this.readinessSection.missingInformation.length > 0;
  }

  get canGenerateTicket(): boolean {
    return this.readinessSection.totalScore >= 80 && !this.hasMissingInformation;
  }

  startRefinement(): void {
    // TODO: Implement refinement session start logic
    console.log('Starting refinement for requirement:', this.state.requirement?.id);
  }

  // B-307: Readiness Gate Override Methods

  openOverrideModal(dimension: ReadinessDimension): void {
    this.currentDimensionForOverride = dimension;
    this.overrideReason = '';
    this.overrideScore = 100;
    this.showOverrideModal = true;
  }

  closeOverrideModal(): void {
    this.showOverrideModal = false;
    this.currentDimensionForOverride = null;
    this.overrideReason = '';
    this.overrideScore = 100;
    this.isCreatingOverride = false;
  }

  createOverride(): void {
    if (!this.currentDimensionForOverride || !this.state.requirement || !this.overrideReason.trim()) {
      return;
    }

    this.isCreatingOverride = true;

    const request: CreateReadinessGateOverrideRequest = {
      requirement_id: this.state.requirement.id,
      dimension_id: this.currentDimensionForOverride.id,
      dimension_name: this.currentDimensionForOverride.name,
      override_reason: this.overrideReason.trim(),
      original_score: this.currentDimensionForOverride.score,
      override_score: this.overrideScore,
      override_type: 'manual'
    };

    this.personaProgressionService.createReadinessOverride(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Override created successfully:', response);

          // Add the new override to the readiness section
          if (!this.readinessSection.overrides) {
            this.readinessSection.overrides = [];
          }
          this.readinessSection.overrides.push(response.override);

          // Recalculate total score with overrides
          this.calculateTotalScore();

          this.closeOverrideModal();
        },
        error: (error) => {
          console.error('Failed to create override:', error);
          this.isCreatingOverride = false;
          // TODO: Show error message to user
        }
      });
  }

  removeOverride(override: ReadinessGateOverride): void {
    if (!confirm('Are you sure you want to remove this override?')) {
      return;
    }

    this.personaProgressionService.deleteReadinessOverride(override.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log('Override removed successfully');

          // Remove override from the list
          if (this.readinessSection.overrides) {
            this.readinessSection.overrides = this.readinessSection.overrides.filter(o => o.id !== override.id);
          }

          // Recalculate total score
          this.calculateTotalScore();
        },
        error: (error) => {
          console.error('Failed to remove override:', error);
          // TODO: Show error message to user
        }
      });
  }

  hasOverride(dimensionId: string): boolean {
    return this.getOverride(dimensionId) !== null;
  }

  getOverride(dimensionId: string): ReadinessGateOverride | null {
    if (!this.readinessSection.overrides) return null;
    return this.readinessSection.overrides.find(o => o.dimension_id === dimensionId && o.is_active) || null;
  }

  getEffectiveScore(dimension: ReadinessDimension): number {
    const override = this.getOverride(dimension.id);
    return override ? override.override_score : dimension.score;
  }
}
