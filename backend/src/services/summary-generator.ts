import { globalAIService } from './ai-provider';
import { RequirementMessageModel } from '../models/RequirementMessage';
import { RefinementSessionModel } from '../models/RefinementSession';
import { RefinementSummaryModel } from '../models/RefinementSummary';
import { ReadinessAnalyzerService } from './readiness-analyzer';
import {
  RequirementMessageWithDetails,
  RefinementSessionWithDetails,
  CreateRefinementSummaryRequest
} from '../models/types';

export interface SummaryGenerationOptions {
  userId?: string;
  projectId?: string;
  summaryType?: 'conversation_progress' | 'final_summary' | 'milestone';
  forceGenerate?: boolean; // Skip the shouldGenerateSummary check
}

export interface GeneratedSummary {
  title: string;
  summary: string;
  key_points: string[];
  clarifications_made: string[];
  outstanding_questions: string[];
  confidence_score: number;
}

export class SummaryGeneratorService {
  /**
   * Generate a summary for a refinement session
   */
  static async generateSummaryForSession(
    sessionId: string,
    options: SummaryGenerationOptions = {}
  ): Promise<string | null> {
    try {
      // Get session details
      const session = await RefinementSessionModel.findByIdWithDetails(sessionId);
      if (!session) {
        throw new Error('Refinement session not found');
      }

      // Get all messages for the session
      const messages = await RequirementMessageModel.findBySessionId(sessionId);
      if (messages.length === 0) {
        return null; // No messages to summarize
      }

      // Check if we should generate a summary
      if (!options.forceGenerate) {
        const shouldGenerate = await RefinementSummaryModel.shouldGenerateSummary(
          sessionId,
          messages.length
        );
        if (!shouldGenerate) {
          return null; // Not time for a new summary yet
        }
      }

      // Generate the summary using AI
      const generatedSummary = await this.generateAISummary(session, messages);

      // Create the summary record
      const summaryData: CreateRefinementSummaryRequest = {
        requirement_id: session.requirement_id,
        session_id: sessionId,
        title: generatedSummary.title,
        summary: generatedSummary.summary,
        key_points: generatedSummary.key_points,
        clarifications_made: generatedSummary.clarifications_made,
        outstanding_questions: generatedSummary.outstanding_questions,
        message_count: messages.length,
        confidence_score: generatedSummary.confidence_score,
        summary_type: options.summaryType || 'conversation_progress',
        generated_by: 'ai',
        ai_model: 'openai', // This would come from the AI service metadata
        ai_tokens_used: 0, // Would be populated from AI response metadata
        generation_metadata: {
          generated_at: new Date().toISOString(),
          message_range: `1-${messages.length}`,
          user_id: options.userId,
          project_id: options.projectId
        }
      };

      const summary = await RefinementSummaryModel.create(summaryData);

      // Trigger readiness analysis after summary generation (B-205)
      try {
        await ReadinessAnalyzerService.analyzeRequirementReadiness(
          session.requirement_id,
          {
            userId: options.userId,
            projectId: options.projectId,
            forceRecompute: true // Always recompute when we have a new summary
          }
        );
      } catch (readinessError) {
        console.error('Error computing readiness after summary generation:', readinessError);
        // Don't fail the summary generation if readiness analysis fails
      }

      return summary.id;
    } catch (error) {
      console.error('Error generating summary for session:', error);
      throw error;
    }
  }

  /**
   * Generate AI summary from conversation messages
   */
  private static async generateAISummary(
    session: RefinementSessionWithDetails,
    messages: RequirementMessageWithDetails[]
  ): Promise<GeneratedSummary> {
    const requirement = session.requirement;

    // Build conversation context for AI
    const conversationText = messages
      .map(msg => {
        const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'AI Assistant' : 'System';
        return `${role}: ${msg.content}`;
      })
      .join('\n\n');

    const systemPrompt = `You are an AI assistant that analyzes software requirement refinement conversations and generates structured summaries.

Your task is to analyze the conversation below and create a comprehensive summary that captures:
1. The current understanding of the requirement
2. Key clarifications that were made
3. Outstanding questions or ambiguities
4. Important insights or decisions

Original Requirement:
- Title: ${requirement.title}
- Description: ${requirement.description || 'No description provided'}
- Type: ${requirement.type}
- Priority: ${requirement.priority}

Conversation to analyze:
${conversationText}

Please respond with a JSON object in this exact format:
{
  "title": "Brief title summarizing current state (max 100 chars)",
  "summary": "Comprehensive summary of the conversation and current requirement understanding (2-3 paragraphs)",
  "key_points": ["List of 3-7 key insights or clarifications made", "Each point should be specific and actionable"],
  "clarifications_made": ["List of specific clarifications that resolved ambiguities", "Focus on concrete details that were added"],
  "outstanding_questions": ["List of questions or ambiguities that still need to be addressed", "Include any edge cases or unclear aspects"],
  "confidence_score": 0.85
}

The confidence_score should be between 0.0 and 1.0, representing how well-defined and clear the requirement has become through this conversation.

Respond only with the JSON object, no other text.`;

    const aiResponse = await globalAIService.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Please analyze this conversation and generate the summary.' }
      ],
      temperature: 0.3, // Lower temperature for more consistent, structured output
      maxTokens: 800
    }, {
      userId: session.user_id,
      projectId: requirement.project_id
    });

    try {
      // Parse the AI response as JSON
      const summary = JSON.parse(aiResponse.content.trim());

      // Validate the required fields
      if (!summary.title || !summary.summary || !Array.isArray(summary.key_points)) {
        throw new Error('Invalid summary format from AI response');
      }

      return {
        title: summary.title.substring(0, 500), // Ensure it fits in DB
        summary: summary.summary,
        key_points: summary.key_points || [],
        clarifications_made: summary.clarifications_made || [],
        outstanding_questions: summary.outstanding_questions || [],
        confidence_score: Math.max(0, Math.min(1, summary.confidence_score || 0.5))
      };
    } catch (parseError) {
      console.error('Error parsing AI summary response:', parseError);
      console.error('Raw AI response:', aiResponse.content);

      // Fallback: create a basic summary from the raw response
      return {
        title: `Summary after ${messages.length} messages`,
        summary: aiResponse.content.substring(0, 1000), // Truncate if too long
        key_points: ['Conversation analyzed', 'Summary generated from AI response'],
        clarifications_made: [],
        outstanding_questions: [],
        confidence_score: 0.3 // Low confidence for fallback summaries
      };
    }
  }

  /**
   * Generate a final summary when a session is completed
   */
  static async generateFinalSummary(
    sessionId: string,
    options: SummaryGenerationOptions = {}
  ): Promise<string | null> {
    return this.generateSummaryForSession(sessionId, {
      ...options,
      summaryType: 'final_summary',
      forceGenerate: true
    });
  }

  /**
   * Get the latest summary for a session
   */
  static async getLatestSummary(sessionId: string) {
    return RefinementSummaryModel.findLatestBySessionId(sessionId);
  }

  /**
   * Get all summaries for a session
   */
  static async getSessionSummaries(sessionId: string) {
    return RefinementSummaryModel.findBySessionId(sessionId);
  }

  /**
   * Get the latest summary for a requirement (across all sessions)
   */
  static async getLatestRequirementSummary(requirementId: string) {
    return RefinementSummaryModel.findLatestByRequirementId(requirementId);
  }
}