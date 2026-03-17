import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { RefinementService } from '../services/refinement.service';
import { RequirementService } from '../services/requirement.service';
import {
  RefinementSessionWithDetails,
  RequirementMessageWithDetails,
  RequirementWithDetails,
  RefinementSummary,
  CreateMessageRequest
} from '../models/refinement.model';

@Component({
  selector: 'app-refinement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './refinement.component.html',
  styleUrl: './refinement.component.css'
})
export class RefinementComponent implements OnInit, OnDestroy {
  @Input() requirementId?: string;
  @Input() sessionId?: string;

  session: RefinementSessionWithDetails | null = null;
  messages: RequirementMessageWithDetails[] = [];
  requirement: RequirementWithDetails | null = null;
  latestSummary: RefinementSummary | null = null;

  // Form state
  newMessage = '';
  isLoading = false;
  isSending = false;
  error = '';

  private subscriptions: Subscription[] = [];

  constructor(
    private refinementService: RefinementService,
    private requirementService: RequirementService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    // Get IDs from route params if not provided as inputs
    this.route.params.subscribe(params => {
      this.sessionId = this.sessionId || params['sessionId'];
      this.requirementId = this.requirementId || params['requirementId'];

      if (this.sessionId) {
        this.loadExistingSession();
      } else if (this.requirementId) {
        this.loadRequirement();
      }
    });

    // Subscribe to session and messages updates
    this.subscriptions.push(
      this.refinementService.activeSession$.subscribe(session => {
        this.session = session;
      }),
      this.refinementService.messages$.subscribe(messages => {
        this.messages = messages;
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private loadRequirement() {
    if (!this.requirementId) return;

    this.isLoading = true;
    this.error = '';

    this.requirementService.getRequirement(this.requirementId).subscribe({
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

  private loadExistingSession() {
    if (!this.sessionId) return;

    this.isLoading = true;
    this.error = '';

    this.refinementService.loadSession(this.sessionId).subscribe({
      next: ({ session, messages }) => {
        this.session = session;
        this.messages = messages;
        this.requirement = session.requirement;
        this.isLoading = false;

        // Load latest summary
        this.loadLatestSummary();
      },
      error: (error) => {
        this.error = 'Failed to load refinement session: ' + (error.error?.message || error.message);
        this.isLoading = false;
      }
    });
  }

  startRefinement() {
    if (!this.requirementId) return;

    this.isLoading = true;
    this.error = '';

    this.refinementService.startRefinementSession({
      requirement_id: this.requirementId
    }).subscribe({
      next: (response) => {
        this.session = response.session;
        this.messages = [response.first_question];
        this.isLoading = false;

        // Load latest summary (there probably won't be one yet, but check anyway)
        this.loadLatestSummary();

        // Update URL to reflect the new session
        this.router.navigate(['/refinement', response.session.id], { replaceUrl: true });
      },
      error: (error) => {
        this.error = 'Failed to start refinement: ' + (error.error?.message || error.message);
        this.isLoading = false;
      }
    });
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.session || this.isSending) return;

    const messageContent = this.newMessage.trim();
    this.newMessage = '';
    this.isSending = true;
    this.error = '';

    const messageData: CreateMessageRequest = {
      content: messageContent,
      message_type: 'user_message'
    };

    this.refinementService.sendMessage(this.session.id, messageData).subscribe({
      next: (response) => {
        this.isSending = false;

        if (response.aiError) {
          this.error = 'AI response failed: ' + response.aiError;
        }

        // If a new summary was generated, refresh the latest summary
        if (response.summaryGenerated) {
          this.loadLatestSummary();
        }
      },
      error: (error) => {
        this.error = 'Failed to send message: ' + (error.error?.message || error.message);
        this.isSending = false;
        // Restore the message if sending failed
        this.newMessage = messageContent;
      }
    });
  }

  onKeyDown(event: KeyboardEvent) {
    // Send message on Ctrl+Enter or Cmd+Enter
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.sendMessage();
    }
  }

  getMessageTimeString(message: RequirementMessageWithDetails): string {
    return new Date(message.created_at).toLocaleTimeString();
  }

  getMessageAuthor(message: RequirementMessageWithDetails): string {
    if (message.role === 'assistant') {
      return 'AI Assistant';
    } else if (message.author) {
      return message.author.name || message.author.username;
    } else {
      return 'Unknown';
    }
  }

  isUserMessage(message: RequirementMessageWithDetails): boolean {
    return message.role === 'user';
  }

  isAIMessage(message: RequirementMessageWithDetails): boolean {
    return message.role === 'assistant';
  }

  trackByMessageId(index: number, message: RequirementMessageWithDetails): string {
    return message.id;
  }

  // Summary-related methods (B-204)

  private loadLatestSummary() {
    if (!this.session?.id) return;

    this.refinementService.getLatestSessionSummary(this.session.id).subscribe({
      next: (summary) => {
        this.latestSummary = summary;
      },
      error: (error) => {
        // Don't show error for missing summaries, it's expected for new sessions
        if (error.status !== 404) {
          console.error('Error loading latest summary:', error);
        }
      }
    });
  }

  generateSummary() {
    if (!this.session?.id) return;

    this.refinementService.generateSessionSummary(this.session.id).subscribe({
      next: (summary) => {
        this.latestSummary = summary;
      },
      error: (error) => {
        this.error = 'Failed to generate summary: ' + (error.error?.message || error.message);
      }
    });
  }

  getSummaryConfidenceText(confidence?: number): string {
    if (!confidence) return 'Unknown';

    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    if (confidence >= 0.4) return 'Low';
    return 'Very Low';
  }

  getSummaryAge(summary: RefinementSummary): string {
    const created = new Date(summary.created_at);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
}