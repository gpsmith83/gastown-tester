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
  ReadinessSection,
  ReadinessDimension,
  ReadinessDimensionStatus
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
    status: 'not_started',
    dimensions: [],
    totalScore: 0,
    missingInformation: []
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
    const totalActual = this.readinessSection.dimensions.reduce((sum, dim) => sum + dim.score, 0);
    this.readinessSection.totalScore = Math.round((totalActual / totalPossible) * 100);

    // Collect all missing information
    this.readinessSection.missingInformation = this.readinessSection.dimensions
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
}
