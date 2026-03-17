import { globalAIService } from './ai-provider';
import { RequirementModel } from '../models/Requirement';
import { RefinementSummaryModel } from '../models/RefinementSummary';
import { RequirementReadinessModel } from '../models/RequirementReadiness';
import {
  RequirementWithDetails,
  RefinementSummary,
  CreateRequirementReadinessRequest
} from '../models/types';

export interface ReadinessAnalysisOptions {
  userId?: string;
  projectId?: string;
  forceRecompute?: boolean; // Recompute even if readiness exists
}

export interface ReadinessAnalysis {
  clarity_score: number;
  completeness_score: number;
  testability_score: number;
  feasibility_score: number;
  specificity_score: number;
  confidence_score: number;
  missing_areas: string[];
  recommendations: string[];
}

export class ReadinessAnalyzerService {
  /**
   * Analyze and compute readiness for a requirement
   */
  static async analyzeRequirementReadiness(
    requirementId: string,
    options: ReadinessAnalysisOptions = {}
  ): Promise<string | null> {
    try {
      // Check if readiness already exists and we're not forcing recompute
      if (!options.forceRecompute) {
        const existingReadiness = await RequirementReadinessModel.findByRequirementId(requirementId);
        if (existingReadiness) {
          return existingReadiness.id; // Already analyzed
        }
      }

      // Get requirement details
      const requirement = await RequirementModel.findByIdWithDetails(requirementId);
      if (!requirement) {
        throw new Error('Requirement not found');
      }

      // Get the latest refinement summary for analysis
      const latestSummary = await RefinementSummaryModel.findLatestByRequirementId(requirementId);

      // Perform AI analysis
      const analysis = await this.performAIReadinessAnalysis(requirement, latestSummary || undefined);

      // Create readiness record
      const readinessData: CreateRequirementReadinessRequest = {
        requirement_id: requirementId,
        clarity_score: analysis.clarity_score,
        completeness_score: analysis.completeness_score,
        testability_score: analysis.testability_score,
        feasibility_score: analysis.feasibility_score,
        specificity_score: analysis.specificity_score,
        analysis_source: 'ai_analysis',
        confidence_score: analysis.confidence_score,
        missing_areas: analysis.missing_areas,
        recommendations: analysis.recommendations,
        computed_from_summary_id: latestSummary?.id,
        ai_model: 'openai', // Would come from AI service metadata
        analysis_metadata: {
          analyzed_at: new Date().toISOString(),
          has_summary: !!latestSummary,
          summary_message_count: latestSummary?.message_count || 0,
          user_id: options.userId,
          project_id: options.projectId
        }
      };

      const readiness = await RequirementReadinessModel.upsert(readinessData);
      return readiness.id;
    } catch (error) {
      console.error('Error analyzing requirement readiness:', error);
      throw error;
    }
  }

  /**
   * Perform AI analysis of requirement readiness
   */
  private static async performAIReadinessAnalysis(
    requirement: RequirementWithDetails,
    summary?: RefinementSummary
  ): Promise<ReadinessAnalysis> {
    // Build analysis context
    const analysisContext = this.buildAnalysisContext(requirement, summary);

    const systemPrompt = `You are an AI assistant that analyzes software requirements to determine their readiness for implementation. You evaluate requirements across 5 key dimensions and provide actionable feedback.

Your task is to analyze the requirement below and score it on these dimensions (0.0 to 1.0 scale):

1. **Clarity** (0.0-1.0): How well-defined and unambiguous is the requirement?
   - 0.0-0.3: Vague, confusing, or contradictory
   - 0.4-0.6: Some clarity but significant ambiguities remain
   - 0.7-0.8: Mostly clear with minor ambiguities
   - 0.9-1.0: Crystal clear and unambiguous

2. **Completeness** (0.0-1.0): Are all necessary details specified?
   - 0.0-0.3: Major gaps, missing critical information
   - 0.4-0.6: Some details provided but key elements missing
   - 0.7-0.8: Most details present, minor gaps
   - 0.9-1.0: All necessary details provided

3. **Testability** (0.0-1.0): Are there clear, measurable acceptance criteria?
   - 0.0-0.3: No clear success criteria, untestable
   - 0.4-0.6: Some criteria but not specific or measurable
   - 0.7-0.8: Good criteria with minor measurement challenges
   - 0.9-1.0: Clear, specific, measurable acceptance criteria

4. **Feasibility** (0.0-1.0): Is the requirement technically achievable and realistic?
   - 0.0-0.3: Technically impossible or extremely unrealistic
   - 0.4-0.6: Technically challenging with significant risks
   - 0.7-0.8: Achievable with some technical complexity
   - 0.9-1.0: Clearly feasible with standard approaches

5. **Specificity** (0.0-1.0): Is the requirement specific enough to guide implementation?
   - 0.0-0.3: Too abstract or high-level to implement
   - 0.4-0.6: Some specific details but still too general
   - 0.7-0.8: Mostly specific with minor implementation questions
   - 0.9-1.0: Highly specific and actionable

${analysisContext}

Please respond with a JSON object in this exact format:
{
  "clarity_score": 0.75,
  "completeness_score": 0.60,
  "testability_score": 0.40,
  "feasibility_score": 0.85,
  "specificity_score": 0.55,
  "confidence_score": 0.80,
  "missing_areas": [
    "Specific list of what's missing or unclear",
    "Each item should be concrete and actionable"
  ],
  "recommendations": [
    "Specific recommendations to improve readiness",
    "Focus on the lowest-scoring dimensions first"
  ]
}

The confidence_score (0.0-1.0) represents how confident you are in your analysis given the available information.

Respond only with the JSON object, no other text.`;

    const aiResponse = await globalAIService.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Please analyze this requirement and provide the readiness assessment.' }
      ],
      temperature: 0.2, // Low temperature for consistent analysis
      maxTokens: 600
    }, {
      userId: requirement.author_id,
      projectId: requirement.project_id
    });

    try {
      // Parse the AI response as JSON
      const analysis = JSON.parse(aiResponse.content.trim());

      // Validate and normalize scores
      return {
        clarity_score: this.normalizeScore(analysis.clarity_score),
        completeness_score: this.normalizeScore(analysis.completeness_score),
        testability_score: this.normalizeScore(analysis.testability_score),
        feasibility_score: this.normalizeScore(analysis.feasibility_score),
        specificity_score: this.normalizeScore(analysis.specificity_score),
        confidence_score: this.normalizeScore(analysis.confidence_score || 0.5),
        missing_areas: Array.isArray(analysis.missing_areas) ? analysis.missing_areas : [],
        recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : []
      };
    } catch (parseError) {
      console.error('Error parsing AI readiness analysis:', parseError);
      console.error('Raw AI response:', aiResponse.content);

      // Fallback: basic analysis based on available data
      return this.generateFallbackAnalysis(requirement, summary);
    }
  }

  /**
   * Build analysis context for AI prompt
   */
  private static buildAnalysisContext(
    requirement: RequirementWithDetails,
    summary?: RefinementSummary
  ): string {
    let context = `**REQUIREMENT TO ANALYZE:**

Title: ${requirement.title}
Type: ${requirement.type}
Priority: ${requirement.priority} (1=highest, 5=lowest)
Status: ${requirement.status}
Description: ${requirement.description || 'No description provided'}
Project: ${requirement.project?.name || 'Unknown'}`;

    if (requirement.github_issue_number) {
      context += `\nGitHub Issue: #${requirement.github_issue_number}`;
    }

    if (summary) {
      context += `\n\n**REFINEMENT SUMMARY (${summary.message_count} messages):**
${summary.summary}`;

      if (summary.key_points && summary.key_points.length > 0) {
        context += `\n\nKey Points Clarified:
${summary.key_points.map(point => `- ${point}`).join('\n')}`;
      }

      if (summary.clarifications_made && summary.clarifications_made.length > 0) {
        context += `\n\nClarifications Made:
${summary.clarifications_made.map(clarification => `- ${clarification}`).join('\n')}`;
      }

      if (summary.outstanding_questions && summary.outstanding_questions.length > 0) {
        context += `\n\nOutstanding Questions:
${summary.outstanding_questions.map(question => `- ${question}`).join('\n')}`;
      }
    } else {
      context += '\n\n**No refinement summary available** - analysis based on original requirement only.';
    }

    return context;
  }

  /**
   * Normalize score to valid 0.0-1.0 range
   */
  private static normalizeScore(score: any): number {
    const numScore = typeof score === 'number' ? score : parseFloat(score) || 0;
    return Math.max(0, Math.min(1, numScore));
  }

  /**
   * Generate fallback analysis when AI parsing fails
   */
  private static generateFallbackAnalysis(
    requirement: RequirementWithDetails,
    summary?: RefinementSummary
  ): ReadinessAnalysis {
    // Basic heuristic analysis
    const hasDescription = !!(requirement.description && requirement.description.length > 20);
    const hasSummary = !!summary;
    const hasRefinement = summary && summary.message_count > 2;

    return {
      clarity_score: hasDescription ? 0.6 : 0.3,
      completeness_score: hasSummary ? 0.7 : (hasDescription ? 0.5 : 0.2),
      testability_score: hasRefinement ? 0.5 : 0.3,
      feasibility_score: 0.7, // Default assumption
      specificity_score: hasRefinement ? 0.6 : (hasDescription ? 0.4 : 0.2),
      confidence_score: 0.3, // Low confidence for fallback
      missing_areas: ['AI analysis failed - manual review recommended'],
      recommendations: ['Review requirement manually', 'Consider adding more detailed description']
    };
  }

  /**
   * Analyze readiness for all requirements in a project
   */
  static async analyzeProjectReadiness(
    projectId: string,
    options: ReadinessAnalysisOptions = {}
  ): Promise<string[]> {
    try {
      // Get all active requirements for the project
      const requirements = await RequirementModel.findByProjectId(projectId);
      const readinessIds: string[] = [];

      // Analyze each requirement
      for (const requirement of requirements) {
        try {
          const readinessId = await this.analyzeRequirementReadiness(requirement.id, {
            ...options,
            projectId
          });
          if (readinessId) {
            readinessIds.push(readinessId);
          }
        } catch (error) {
          console.error(`Error analyzing readiness for requirement ${requirement.id}:`, error);
          // Continue with other requirements even if one fails
        }
      }

      return readinessIds;
    } catch (error) {
      console.error('Error analyzing project readiness:', error);
      throw error;
    }
  }

  /**
   * Get readiness for a requirement
   */
  static async getRequirementReadiness(requirementId: string) {
    return RequirementReadinessModel.findByRequirementIdWithDetails(requirementId);
  }

  /**
   * Get project readiness statistics
   */
  static async getProjectReadinessStats(projectId: string) {
    return RequirementReadinessModel.getProjectReadinessStats(projectId);
  }
}