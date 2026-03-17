import { RequirementReadinessModel } from '../models/RequirementReadiness';
import { ReadinessGateOverrideModel } from '../models/ReadinessGateOverride';
import {
  RequirementReadiness,
  ReadinessGateResult,
  ReadinessGateRules,
  CreateReadinessGateOverrideRequest
} from '../models/types';

export interface ReadinessGateOptions {
  // Custom gate rules (override defaults)
  customRules?: Partial<ReadinessGateRules>;

  // Whether to include override information in results
  includeOverrideDetails?: boolean;
}

export class ReadinessGateService {
  /**
   * Default readiness gate rules
   * These define what constitutes "sufficient" readiness for ticket generation
   */
  private static readonly DEFAULT_GATE_RULES: ReadinessGateRules = {
    // Overall score must be at least "ready" level
    minimum_overall_score: 0.7,

    // Critical dimensions that MUST meet minimum thresholds (blocking dimensions)
    minimum_clarity_score: 0.6,      // Must be reasonably clear
    minimum_completeness_score: 0.6,  // Must have essential details
    minimum_testability_score: 0.5,   // Must have some acceptance criteria
    minimum_feasibility_score: 0.5,   // Must be technically achievable
    minimum_specificity_score: 0.5,   // Must be specific enough to start

    // Alternative check: must be at least "ready" level
    minimum_readiness_level: 'ready'
  };

  /**
   * Check if a requirement passes the readiness gate
   */
  static async checkReadinessGate(
    requirementId: string,
    options: ReadinessGateOptions = {}
  ): Promise<ReadinessGateResult> {
    try {
      // Get the current readiness analysis for the requirement
      const readiness = await RequirementReadinessModel.findByRequirementId(requirementId);

      if (!readiness) {
        return this.createFailedGateResult(requirementId, 'No readiness analysis found', options);
      }

      // Get gate rules (use custom rules if provided)
      const gateRules = { ...this.DEFAULT_GATE_RULES, ...options.customRules };

      // Check for active override
      const activeOverride = await ReadinessGateOverrideModel.findActiveByRequirementId(requirementId);

      // Perform gate checks
      const gateCheckResults = this.performGateChecks(readiness, gateRules);

      // Build result
      const result: ReadinessGateResult = {
        requirement_id: requirementId,
        gate_passed: gateCheckResults.passed || !!activeOverride,
        overall_score: readiness.overall_score,
        readiness_level: readiness.readiness_level,
        blocking_dimensions: gateCheckResults.blockingDimensions,
        dimension_scores: {
          clarity_score: readiness.clarity_score,
          completeness_score: readiness.completeness_score,
          testability_score: readiness.testability_score,
          feasibility_score: readiness.feasibility_score,
          specificity_score: readiness.specificity_score
        },
        gate_rules_applied: gateRules,
        has_active_override: !!activeOverride,
        confidence_score: readiness.confidence_score,
        missing_areas: readiness.missing_areas,
        recommendations: readiness.recommendations,
        checked_at: new Date()
      };

      // Include override details if requested
      if (options.includeOverrideDetails && activeOverride) {
        result.override_details = activeOverride;
      }

      return result;
    } catch (error) {
      console.error('Error checking readiness gate:', error);
      return this.createFailedGateResult(requirementId, 'Gate check failed due to error', options);
    }
  }

  /**
   * Perform the actual gate checks against readiness scores
   */
  private static performGateChecks(
    readiness: RequirementReadiness,
    gateRules: ReadinessGateRules
  ): { passed: boolean; blockingDimensions: string[] } {
    const blockingDimensions: string[] = [];

    // Check overall score
    if (readiness.overall_score < gateRules.minimum_overall_score) {
      blockingDimensions.push('overall_score');
    }

    // Check individual dimension thresholds (blocking dimensions)
    if (readiness.clarity_score < gateRules.minimum_clarity_score) {
      blockingDimensions.push('clarity');
    }

    if (readiness.completeness_score < gateRules.minimum_completeness_score) {
      blockingDimensions.push('completeness');
    }

    if (readiness.testability_score < gateRules.minimum_testability_score) {
      blockingDimensions.push('testability');
    }

    if (readiness.feasibility_score < gateRules.minimum_feasibility_score) {
      blockingDimensions.push('feasibility');
    }

    if (readiness.specificity_score < gateRules.minimum_specificity_score) {
      blockingDimensions.push('specificity');
    }

    // Check readiness level (alternative gate)
    const readinessLevelValues = {
      'not_ready': 0,
      'partially_ready': 1,
      'ready': 2,
      'fully_ready': 3
    };

    const currentLevel = readinessLevelValues[readiness.readiness_level];
    const requiredLevel = readinessLevelValues[gateRules.minimum_readiness_level];

    if (currentLevel < requiredLevel) {
      if (!blockingDimensions.includes('overall_score')) {
        blockingDimensions.push('readiness_level');
      }
    }

    return {
      passed: blockingDimensions.length === 0,
      blockingDimensions
    };
  }

  /**
   * Create a failed gate result for error cases
   */
  private static createFailedGateResult(
    requirementId: string,
    reason: string,
    options: ReadinessGateOptions
  ): ReadinessGateResult {
    const gateRules = { ...this.DEFAULT_GATE_RULES, ...options.customRules };

    return {
      requirement_id: requirementId,
      gate_passed: false,
      overall_score: 0,
      readiness_level: 'not_ready',
      blocking_dimensions: ['analysis_missing'],
      dimension_scores: {
        clarity_score: 0,
        completeness_score: 0,
        testability_score: 0,
        feasibility_score: 0,
        specificity_score: 0
      },
      gate_rules_applied: gateRules,
      has_active_override: false,
      missing_areas: [reason],
      recommendations: ['Complete readiness analysis before checking gate'],
      checked_at: new Date()
    };
  }

  /**
   * Create a readiness gate override
   */
  static async createOverride(
    data: CreateReadinessGateOverrideRequest,
    overridden_by: string
  ): Promise<string> {
    try {
      // Get current gate check to store with override
      const gateCheck = await this.checkReadinessGate(data.requirement_id);

      const overrideData: CreateReadinessGateOverrideRequest = {
        ...data,
        gate_check_result: gateCheck,
        readiness_score_at_override: data.readiness_score_at_override || gateCheck.overall_score,
        blocking_dimensions: data.blocking_dimensions || gateCheck.blocking_dimensions
      };

      const override = await ReadinessGateOverrideModel.create(overrideData, overridden_by);
      return override.id;
    } catch (error) {
      console.error('Error creating readiness gate override:', error);
      throw error;
    }
  }

  /**
   * Revoke a readiness gate override
   */
  static async revokeOverride(overrideId: string, revoked_by: string): Promise<boolean> {
    try {
      const result = await ReadinessGateOverrideModel.revoke(overrideId, revoked_by);
      return !!result;
    } catch (error) {
      console.error('Error revoking readiness gate override:', error);
      throw error;
    }
  }

  /**
   * Get active override for a requirement
   */
  static async getActiveOverride(requirementId: string) {
    return ReadinessGateOverrideModel.findActiveByRequirementId(requirementId);
  }

  /**
   * Get all overrides for a requirement
   */
  static async getRequirementOverrides(requirementId: string) {
    return ReadinessGateOverrideModel.findByRequirementId(requirementId);
  }

  /**
   * Check multiple requirements for gate passage (bulk operation)
   */
  static async checkMultipleRequirements(
    requirementIds: string[],
    options: ReadinessGateOptions = {}
  ): Promise<ReadinessGateResult[]> {
    const results: ReadinessGateResult[] = [];

    for (const requirementId of requirementIds) {
      try {
        const result = await this.checkReadinessGate(requirementId, options);
        results.push(result);
      } catch (error) {
        console.error(`Error checking gate for requirement ${requirementId}:`, error);
        results.push(this.createFailedGateResult(requirementId, 'Gate check error', options));
      }
    }

    return results;
  }

  /**
   * Get gate statistics for a project
   */
  static async getProjectGateStats(projectId: string): Promise<{
    total_requirements: number;
    passed_gate: number;
    failed_gate: number;
    with_overrides: number;
    blocking_dimensions_summary: { [dimension: string]: number };
  }> {
    // This would need to be implemented to get all requirements in a project
    // and check their gate status - placeholder for now
    throw new Error('Project gate stats not yet implemented');
  }

  /**
   * Get the default gate rules
   */
  static getDefaultGateRules(): ReadinessGateRules {
    return { ...this.DEFAULT_GATE_RULES };
  }

  /**
   * Validate if gate rules are properly configured
   */
  static validateGateRules(rules: ReadinessGateRules): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check score ranges
    if (rules.minimum_overall_score < 0 || rules.minimum_overall_score > 1) {
      errors.push('minimum_overall_score must be between 0 and 1');
    }

    if (rules.minimum_clarity_score < 0 || rules.minimum_clarity_score > 1) {
      errors.push('minimum_clarity_score must be between 0 and 1');
    }

    if (rules.minimum_completeness_score < 0 || rules.minimum_completeness_score > 1) {
      errors.push('minimum_completeness_score must be between 0 and 1');
    }

    if (rules.minimum_testability_score < 0 || rules.minimum_testability_score > 1) {
      errors.push('minimum_testability_score must be between 0 and 1');
    }

    if (rules.minimum_feasibility_score < 0 || rules.minimum_feasibility_score > 1) {
      errors.push('minimum_feasibility_score must be between 0 and 1');
    }

    if (rules.minimum_specificity_score < 0 || rules.minimum_specificity_score > 1) {
      errors.push('minimum_specificity_score must be between 0 and 1');
    }

    // Check readiness level
    const validLevels = ['not_ready', 'partially_ready', 'ready', 'fully_ready'];
    if (!validLevels.includes(rules.minimum_readiness_level)) {
      errors.push('minimum_readiness_level must be one of: ' + validLevels.join(', '));
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Clean up expired overrides (should be run periodically)
   */
  static async cleanupExpiredOverrides(): Promise<number> {
    return ReadinessGateOverrideModel.cleanupExpiredOverrides();
  }
}