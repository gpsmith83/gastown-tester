import { RequirementModel } from '../models/Requirement';
import {
  RequirementReadinessState,
  ReadinessDimension,
  ReadinessGap,
  PersonaProgressionConfig,
  PersonaProgressionRule,
  PersonaRecommendation,
  GetPersonaRecommendationRequest,
  PersonaRecommendationResponse,
  Requirement
} from '../models/types';

/**
 * Service for evaluating requirement readiness and recommending next personas
 * based on default progression rules (B-302)
 */
export class PersonaProgressionService {

  /**
   * Get persona recommendation for a requirement
   */
  static async getPersonaRecommendation(
    request: GetPersonaRecommendationRequest
  ): Promise<PersonaRecommendationResponse> {
    try {
      console.log(`[PERSONA_PROGRESSION] Getting recommendation for requirement: ${request.requirement_id}`);

      // Get the requirement details
      const requirement = await RequirementModel.findById(request.requirement_id);
      if (!requirement) {
        return {
          recommendation: null,
          fallback_reason: 'Requirement not found',
          error: 'Invalid requirement ID'
        };
      }

      // Assess current readiness state
      const readinessState = await this.assessRequirementReadiness(requirement);

      // Get default progression configuration
      const progressionConfig = await this.getDefaultProgressionConfig();

      // Generate recommendation based on readiness gaps and progression rules
      const recommendation = await this.generateRecommendation(
        requirement,
        readinessState,
        progressionConfig,
        request
      );

      return {
        recommendation
      };
    } catch (error) {
      console.error('[PERSONA_PROGRESSION] Error generating recommendation:', error);
      return {
        recommendation: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Assess the current readiness state of a requirement
   */
  private static async assessRequirementReadiness(
    requirement: Requirement
  ): Promise<RequirementReadinessState> {
    console.log(`[PERSONA_PROGRESSION] Assessing readiness for requirement: ${requirement.id}`);

    // Analyze different readiness dimensions
    const dimensions = this.analyzeDimensions(requirement);
    const gaps = this.identifyGaps(dimensions);
    const overallReadiness = this.calculateOverallReadiness(dimensions);

    return {
      requirement_id: requirement.id,
      overall_readiness: overallReadiness,
      readiness_dimensions: dimensions,
      gaps_identified: gaps,
      last_assessed_at: new Date()
    };
  }

  /**
   * Analyze different dimensions of requirement readiness
   */
  private static analyzeDimensions(requirement: Requirement): ReadinessDimension[] {
    const dimensions: ReadinessDimension[] = [];

    // Scope clarity dimension
    const scopeState = this.assessScopeClarity(requirement);
    dimensions.push({
      dimension_name: 'scope_clarity',
      dimension_category: 'scope',
      current_state: scopeState.state,
      confidence_score: scopeState.confidence
    });

    // Acceptance criteria dimension
    const acceptanceState = this.assessAcceptanceCriteria(requirement);
    dimensions.push({
      dimension_name: 'acceptance_criteria',
      dimension_category: 'acceptance_criteria',
      current_state: acceptanceState.state,
      confidence_score: acceptanceState.confidence
    });

    // Technical clarity dimension
    const technicalState = this.assessTechnicalClarity(requirement);
    dimensions.push({
      dimension_name: 'technical_approach',
      dimension_category: 'technical_clarity',
      current_state: technicalState.state,
      confidence_score: technicalState.confidence
    });

    // User impact dimension
    const userImpactState = this.assessUserImpact(requirement);
    dimensions.push({
      dimension_name: 'user_impact',
      dimension_category: 'user_impact',
      current_state: userImpactState.state,
      confidence_score: userImpactState.confidence
    });

    return dimensions;
  }

  /**
   * Assess scope clarity based on title and description
   */
  private static assessScopeClarity(requirement: Requirement): { state: ReadinessDimension['current_state'], confidence: number } {
    const title = requirement.title || '';
    const description = requirement.description || '';

    // Check title quality
    const titleScore = this.scoreTitleClarity(title);

    // Check description quality
    const descriptionScore = this.scoreDescriptionClarity(description);

    const averageScore = (titleScore + descriptionScore) / 2;

    if (averageScore >= 80) {
      return { state: 'complete', confidence: averageScore };
    } else if (averageScore >= 60) {
      return { state: 'partial', confidence: averageScore };
    } else if (averageScore >= 30) {
      return { state: 'draft', confidence: averageScore };
    } else {
      return { state: 'missing', confidence: averageScore };
    }
  }

  /**
   * Score title clarity (0-100)
   */
  private static scoreTitleClarity(title: string): number {
    if (!title || title.length < 5) return 0;

    let score = 40; // Base score for having a title

    // Length check (good titles are 10-80 characters)
    if (title.length >= 10 && title.length <= 80) score += 20;
    else if (title.length > 80) score += 10;

    // Contains action words
    const actionWords = /\b(add|create|implement|fix|update|remove|improve|build|design|integrate)\b/i;
    if (actionWords.test(title)) score += 20;

    // Specific vs vague
    const specificWords = /\b(user|api|database|ui|button|page|form|service|component)\b/i;
    if (specificWords.test(title)) score += 20;

    return Math.min(100, score);
  }

  /**
   * Score description clarity (0-100)
   */
  private static scoreDescriptionClarity(description: string): number {
    if (!description || description.length < 10) return 20; // Minimum score for having any description

    let score = 50; // Base score for having a meaningful description

    // Length check (good descriptions are 50-500 characters)
    if (description.length >= 50) score += 20;
    if (description.length >= 200) score += 10;

    // Structure indicators
    if (description.includes('As a') || description.includes('I want') || description.includes('So that')) score += 10;
    if (description.includes('Given') || description.includes('When') || description.includes('Then')) score += 10;

    return Math.min(100, score);
  }

  /**
   * Assess acceptance criteria readiness
   */
  private static assessAcceptanceCriteria(requirement: Requirement): { state: ReadinessDimension['current_state'], confidence: number } {
    const description = requirement.description || '';

    // Check for acceptance criteria indicators
    const hasAcceptanceCriteria = /acceptance criteria|given.*when.*then|requirements:|criteria:|must|should|will/i.test(description);

    if (hasAcceptanceCriteria) {
      // Count criteria-like statements
      const criteriaMatches = description.match(/(?:given|when|then|must|should|will|requirement|criteria).+/gi) || [];
      const criteriaCount = criteriaMatches.length;

      if (criteriaCount >= 3) {
        return { state: 'complete', confidence: 90 };
      } else if (criteriaCount >= 1) {
        return { state: 'partial', confidence: 70 };
      } else {
        return { state: 'draft', confidence: 50 };
      }
    }

    return { state: 'missing', confidence: 30 };
  }

  /**
   * Assess technical clarity
   */
  private static assessTechnicalClarity(requirement: Requirement): { state: ReadinessDimension['current_state'], confidence: number } {
    const description = requirement.description || '';
    const title = requirement.title || '';
    const combined = (title + ' ' + description).toLowerCase();

    // Look for technical indicators
    const technicalTerms = /api|database|service|component|endpoint|interface|model|schema|framework|library|authentication|authorization|validation/i;
    const hasTechnicalTerms = technicalTerms.test(combined);

    // Look for technical constraints or requirements
    const technicalConstraints = /performance|security|scalability|compatibility|integration|protocol|format|standard/i;
    const hasTechnicalConstraints = technicalConstraints.test(combined);

    let score = 30; // Base score

    if (hasTechnicalTerms) score += 30;
    if (hasTechnicalConstraints) score += 25;
    if (description.length > 100) score += 15; // Longer descriptions tend to have more technical detail

    if (score >= 80) {
      return { state: 'complete', confidence: score };
    } else if (score >= 60) {
      return { state: 'partial', confidence: score };
    } else if (score >= 40) {
      return { state: 'draft', confidence: score };
    } else {
      return { state: 'missing', confidence: score };
    }
  }

  /**
   * Assess user impact clarity
   */
  private static assessUserImpact(requirement: Requirement): { state: ReadinessDimension['current_state'], confidence: number } {
    const description = requirement.description || '';
    const title = requirement.title || '';
    const combined = (title + ' ' + description).toLowerCase();

    // Look for user-focused language
    const userIndicators = /user|customer|stakeholder|persona|role|workflow|experience|interface|usability/i;
    const hasUserIndicators = userIndicators.test(combined);

    // Look for impact/value statements
    const impactIndicators = /benefit|value|improve|enable|allow|help|support|solve|problem|goal|outcome/i;
    const hasImpactIndicators = impactIndicators.test(combined);

    // Look for user story format
    const userStoryFormat = /as a.*i want.*so that/i;
    const isUserStory = userStoryFormat.test(combined);

    let score = 25; // Base score

    if (hasUserIndicators) score += 30;
    if (hasImpactIndicators) score += 30;
    if (isUserStory) score += 15;

    if (score >= 80) {
      return { state: 'complete', confidence: score };
    } else if (score >= 60) {
      return { state: 'partial', confidence: score };
    } else if (score >= 40) {
      return { state: 'draft', confidence: score };
    } else {
      return { state: 'missing', confidence: score };
    }
  }

  /**
   * Identify readiness gaps based on dimension analysis
   */
  private static identifyGaps(dimensions: ReadinessDimension[]): ReadinessGap[] {
    const gaps: ReadinessGap[] = [];

    dimensions.forEach(dimension => {
      if (dimension.current_state === 'missing' || dimension.current_state === 'draft') {
        const gap = this.createGapForDimension(dimension);
        if (gap) gaps.push(gap);
      }
    });

    return gaps.sort((a, b) => this.getGapPriorityScore(b) - this.getGapPriorityScore(a));
  }

  /**
   * Create a readiness gap for a specific dimension
   */
  private static createGapForDimension(dimension: ReadinessDimension): ReadinessGap | null {
    const gapConfig = {
      'scope_clarity': {
        type: 'unclear_scope',
        description: 'The requirement scope and boundaries need clarification',
        personas: ['business_analyst', 'product_manager', 'domain_expert'],
        priority: 'high' as const
      },
      'acceptance_criteria': {
        type: 'missing_acceptance_criteria',
        description: 'Clear acceptance criteria and success conditions are needed',
        personas: ['business_analyst', 'qa_specialist', 'product_owner'],
        priority: 'critical' as const
      },
      'technical_approach': {
        type: 'technical_ambiguity',
        description: 'Technical approach, architecture, and implementation details need definition',
        personas: ['technical_architect', 'senior_developer', 'system_designer'],
        priority: 'medium' as const
      },
      'user_impact': {
        type: 'unclear_user_impact',
        description: 'User value, impact, and experience considerations need exploration',
        personas: ['ux_researcher', 'user_advocate', 'product_designer'],
        priority: 'medium' as const
      }
    };

    const config = gapConfig[dimension.dimension_name as keyof typeof gapConfig];
    if (!config) return null;

    return {
      gap_type: config.type,
      gap_description: config.description,
      suggested_persona_types: config.personas,
      priority: config.priority,
      estimated_effort: this.estimateEffortForGap(dimension)
    };
  }

  /**
   * Estimate effort needed to address a gap
   */
  private static estimateEffortForGap(dimension: ReadinessDimension): ReadinessGap['estimated_effort'] {
    if (dimension.confidence_score < 30) return 'large';
    if (dimension.confidence_score < 60) return 'medium';
    return 'small';
  }

  /**
   * Get numeric priority score for gap sorting
   */
  private static getGapPriorityScore(gap: ReadinessGap): number {
    const priorityScores = { critical: 4, high: 3, medium: 2, low: 1 };
    return priorityScores[gap.priority];
  }

  /**
   * Calculate overall readiness based on dimensions
   */
  private static calculateOverallReadiness(dimensions: ReadinessDimension[]): RequirementReadinessState['overall_readiness'] {
    const averageScore = dimensions.reduce((sum, dim) => sum + dim.confidence_score, 0) / dimensions.length;
    const missingCount = dimensions.filter(dim => dim.current_state === 'missing').length;

    if (missingCount > 2) return 'not_started';
    if (averageScore >= 85) return 'ready';
    if (averageScore >= 70) return 'developing';
    if (averageScore >= 50) return 'initial';
    return 'not_started';
  }

  /**
   * Get the default progression configuration
   */
  private static async getDefaultProgressionConfig(): Promise<PersonaProgressionConfig> {
    // For now, return a hardcoded default progression config
    // In the future, this could be stored in the database
    return {
      id: 'default-progression-v1',
      name: 'Default Persona Progression',
      description: 'Standard progression rules for persona recommendations',
      is_default: true,
      progression_rules: this.getDefaultProgressionRules(),
      created_at: new Date('2024-01-01'),
      updated_at: new Date()
    };
  }

  /**
   * Get default progression rules
   */
  private static getDefaultProgressionRules(): PersonaProgressionRule[] {
    return [
      {
        rule_name: 'critical_acceptance_criteria_missing',
        condition: {
          missing_dimensions: ['acceptance_criteria'],
          priority_threshold: 'critical'
        },
        recommended_persona: {
          persona_type: 'business_analyst',
          persona_name: 'Business Analysis Specialist',
          invocation_reason: 'Critical acceptance criteria are missing and need immediate definition',
          expected_contributions: ['acceptance_criteria', 'business_rules', 'edge_cases']
        },
        priority: 1
      },
      {
        rule_name: 'scope_unclear_high_priority',
        condition: {
          missing_dimensions: ['scope_clarity'],
          priority_threshold: 'high'
        },
        recommended_persona: {
          persona_type: 'product_manager',
          persona_name: 'Product Strategy Advisor',
          invocation_reason: 'Requirement scope needs clarification and strategic alignment',
          expected_contributions: ['scope_definition', 'strategic_alignment', 'priority_rationale']
        },
        priority: 2
      },
      {
        rule_name: 'technical_complexity_needs_architecture',
        condition: {
          missing_dimensions: ['technical_approach'],
          gap_types: ['technical_ambiguity']
        },
        recommended_persona: {
          persona_type: 'technical_architect',
          persona_name: 'System Architecture Specialist',
          invocation_reason: 'Technical approach and architecture decisions need expert guidance',
          expected_contributions: ['technical_design', 'architecture_decisions', 'implementation_strategy']
        },
        priority: 3
      },
      {
        rule_name: 'user_experience_missing',
        condition: {
          missing_dimensions: ['user_impact'],
          readiness_state: 'initial'
        },
        recommended_persona: {
          persona_type: 'ux_researcher',
          persona_name: 'User Experience Advocate',
          invocation_reason: 'User impact and experience considerations need exploration',
          expected_contributions: ['user_scenarios', 'usability_requirements', 'user_value_analysis']
        },
        priority: 4
      },
      {
        rule_name: 'general_business_analysis',
        condition: {
          readiness_state: 'not_started'
        },
        recommended_persona: {
          persona_type: 'business_analyst',
          persona_name: 'Requirements Analysis Specialist',
          invocation_reason: 'Comprehensive business analysis needed to establish requirement foundation',
          expected_contributions: ['requirement_clarification', 'stakeholder_analysis', 'business_context']
        },
        priority: 5
      }
    ];
  }

  /**
   * Generate persona recommendation based on readiness state and progression rules
   */
  private static async generateRecommendation(
    requirement: Requirement,
    readinessState: RequirementReadinessState,
    progressionConfig: PersonaProgressionConfig,
    request: GetPersonaRecommendationRequest
  ): Promise<PersonaRecommendation> {
    console.log(`[PERSONA_PROGRESSION] Generating recommendation for requirement ${requirement.id} with readiness state: ${readinessState.overall_readiness}`);

    // Find the best matching rule
    const matchingRule = this.findBestMatchingRule(readinessState, progressionConfig.progression_rules);

    if (!matchingRule) {
      throw new Error('No matching progression rule found');
    }

    // Generate primary recommendation
    const recommendation: PersonaRecommendation = {
      requirement_id: requirement.id,
      session_id: request.session_id,
      recommended_persona: {
        persona_type: matchingRule.recommended_persona.persona_type,
        persona_name: matchingRule.recommended_persona.persona_name || matchingRule.recommended_persona.persona_type,
        invocation_reason: matchingRule.recommended_persona.invocation_reason,
        expected_contributions: matchingRule.recommended_persona.expected_contributions,
        confidence_score: this.calculateConfidenceScore(readinessState, matchingRule)
      },
      readiness_analysis: {
        current_state: readinessState,
        primary_gaps: readinessState.gaps_identified.slice(0, 3), // Top 3 gaps
        progression_rationale: this.generateProgressionRationale(readinessState, matchingRule)
      },
      alternative_personas: this.generateAlternativePersonas(readinessState, progressionConfig.progression_rules, matchingRule),
      generated_at: new Date()
    };

    return recommendation;
  }

  /**
   * Find the best matching progression rule
   */
  private static findBestMatchingRule(
    readinessState: RequirementReadinessState,
    rules: PersonaProgressionRule[]
  ): PersonaProgressionRule | null {

    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      if (this.ruleMatches(readinessState, rule)) {
        console.log(`[PERSONA_PROGRESSION] Matched rule: ${rule.rule_name}`);
        return rule;
      }
    }

    return null;
  }

  /**
   * Check if a rule matches the current readiness state
   */
  private static ruleMatches(readinessState: RequirementReadinessState, rule: PersonaProgressionRule): boolean {
    const condition = rule.condition;

    // Check readiness state condition
    if (condition.readiness_state && readinessState.overall_readiness !== condition.readiness_state) {
      return false;
    }

    // Check missing dimensions condition
    if (condition.missing_dimensions) {
      const missingDimensions = readinessState.readiness_dimensions
        .filter(dim => dim.current_state === 'missing' || dim.current_state === 'draft')
        .map(dim => dim.dimension_name);

      const hasRequiredMissingDimensions = condition.missing_dimensions.some(required =>
        missingDimensions.includes(required)
      );

      if (!hasRequiredMissingDimensions) {
        return false;
      }
    }

    // Check gap types condition
    if (condition.gap_types) {
      const gapTypes = readinessState.gaps_identified.map(gap => gap.gap_type);
      const hasRequiredGapTypes = condition.gap_types.some(required =>
        gapTypes.includes(required)
      );

      if (!hasRequiredGapTypes) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate confidence score for a recommendation
   */
  private static calculateConfidenceScore(readinessState: RequirementReadinessState, rule: PersonaProgressionRule): number {
    let baseScore = 75; // Base confidence

    // Adjust based on how well the rule matches
    const criticalGaps = readinessState.gaps_identified.filter(gap => gap.priority === 'critical').length;
    if (criticalGaps > 0) baseScore += 15; // High confidence for critical gaps

    // Adjust based on overall readiness
    const readinessBonus = {
      'not_started': 10,
      'initial': 5,
      'developing': 0,
      'ready': -5,
      'completed': -10
    };

    baseScore += readinessBonus[readinessState.overall_readiness] || 0;

    return Math.min(100, Math.max(50, baseScore));
  }

  /**
   * Generate rationale for the progression recommendation
   */
  private static generateProgressionRationale(
    readinessState: RequirementReadinessState,
    rule: PersonaProgressionRule
  ): string {
    const gaps = readinessState.gaps_identified;
    const criticalGaps = gaps.filter(gap => gap.priority === 'critical');
    const highGaps = gaps.filter(gap => gap.priority === 'high');

    let rationale = `Based on the current readiness state (${readinessState.overall_readiness}), `;

    if (criticalGaps.length > 0) {
      rationale += `there are ${criticalGaps.length} critical gap(s) that need immediate attention. `;
    }

    if (highGaps.length > 0) {
      rationale += `Additionally, ${highGaps.length} high-priority gap(s) should be addressed. `;
    }

    rationale += `The ${rule.recommended_persona.persona_name} is recommended because `;
    rationale += `they specialize in ${rule.recommended_persona.expected_contributions.join(', ')} `;
    rationale += `which directly addresses the identified gaps.`;

    return rationale;
  }

  /**
   * Generate alternative persona recommendations
   */
  private static generateAlternativePersonas(
    readinessState: RequirementReadinessState,
    rules: PersonaProgressionRule[],
    selectedRule: PersonaProgressionRule
  ): PersonaRecommendation['alternative_personas'] {
    const alternatives: PersonaRecommendation['alternative_personas'] = [];

    // Find other rules that could apply
    const applicableRules = rules.filter(rule =>
      rule !== selectedRule && this.ruleMatches(readinessState, rule)
    );

    for (const rule of applicableRules.slice(0, 2)) { // Limit to top 2 alternatives
      alternatives.push({
        persona_type: rule.recommended_persona.persona_type,
        persona_name: rule.recommended_persona.persona_name || rule.recommended_persona.persona_type,
        reason: `Alternative choice: ${rule.recommended_persona.invocation_reason}`,
        confidence_score: this.calculateConfidenceScore(readinessState, rule) - 10 // Lower than primary
      });
    }

    return alternatives;
  }
}