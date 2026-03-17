import {
  AIProviderUsageMetadata,
  AIProviderType,
  AICompletionRequest,
  AICompletionResponse,
} from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for tracking AI provider usage and metadata
 */
export class AIUsageTracker {
  private usageLog: AIProviderUsageMetadata[] = [];

  /**
   * Records usage metadata for an AI provider call
   * @param metadata Usage metadata to record
   */
  recordUsage(metadata: AIProviderUsageMetadata): void {
    this.usageLog.push(metadata);

    // Log to console for debugging (in production, this would go to a proper logging service)
    console.log('[AI_USAGE]', {
      id: metadata.id,
      provider: metadata.provider,
      model: metadata.model,
      tokens: metadata.totalTokens,
      latency: metadata.latencyMs,
      success: metadata.success,
      timestamp: metadata.timestamp,
    });

    // Keep only last 1000 entries in memory
    if (this.usageLog.length > 1000) {
      this.usageLog.shift();
    }
  }

  /**
   * Creates usage metadata from a completed AI provider call
   * @param provider Provider type
   * @param model Model used
   * @param request Original request
   * @param response Provider response (if successful)
   * @param startTime When the request started
   * @param endTime When the request completed
   * @param error Error if the request failed
   * @param userId Optional user ID
   * @param projectId Optional project ID
   * @param endpoint Provider endpoint used
   * @returns Usage metadata object
   */
  createUsageMetadata(
    provider: AIProviderType,
    model: string,
    request: AICompletionRequest,
    response: AICompletionResponse | null,
    startTime: number,
    endTime: number,
    error: Error | null = null,
    userId?: string,
    projectId?: string,
    endpoint: string = ''
  ): AIProviderUsageMetadata {
    return {
      id: uuidv4(),
      provider,
      model,
      timestamp: new Date(),
      requestTokens: response?.usage?.promptTokens || 0,
      responseTokens: response?.usage?.completionTokens || 0,
      totalTokens: response?.usage?.totalTokens || 0,
      latencyMs: endTime - startTime,
      success: error === null,
      errorCode: error ? 'ERROR' : undefined,
      errorMessage: error?.message,
      userId,
      projectId,
      endpoint,
    };
  }

  /**
   * Gets recent usage statistics
   * @param limit Number of entries to return (default: 100)
   * @returns Array of recent usage metadata
   */
  getRecentUsage(limit: number = 100): AIProviderUsageMetadata[] {
    return this.usageLog.slice(-limit);
  }

  /**
   * Gets usage statistics for a specific provider
   * @param provider Provider type to filter by
   * @param limit Number of entries to return (default: 100)
   * @returns Array of usage metadata for the provider
   */
  getProviderUsage(
    provider: AIProviderType,
    limit: number = 100
  ): AIProviderUsageMetadata[] {
    return this.usageLog
      .filter((entry) => entry.provider === provider)
      .slice(-limit);
  }

  /**
   * Gets aggregated usage statistics
   * @param timeframe Time period to aggregate (optional)
   * @returns Aggregated usage statistics
   */
  getUsageStats(timeframe?: { start: Date; end: Date }): {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalTokens: number;
    averageLatency: number;
    byProvider: Record<string, { calls: number; tokens: number }>;
  } {
    let relevantUsage = this.usageLog;

    if (timeframe) {
      relevantUsage = this.usageLog.filter(
        (entry) =>
          entry.timestamp >= timeframe.start && entry.timestamp <= timeframe.end
      );
    }

    const totalCalls = relevantUsage.length;
    const successfulCalls = relevantUsage.filter((entry) => entry.success).length;
    const failedCalls = totalCalls - successfulCalls;
    const totalTokens = relevantUsage.reduce(
      (sum, entry) => sum + entry.totalTokens,
      0
    );
    const averageLatency = totalCalls > 0
      ? relevantUsage.reduce((sum, entry) => sum + entry.latencyMs, 0) / totalCalls
      : 0;

    const byProvider: Record<string, { calls: number; tokens: number }> = {};
    for (const entry of relevantUsage) {
      if (!byProvider[entry.provider]) {
        byProvider[entry.provider] = { calls: 0, tokens: 0 };
      }
      byProvider[entry.provider].calls++;
      byProvider[entry.provider].tokens += entry.totalTokens;
    }

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      totalTokens,
      averageLatency,
      byProvider,
    };
  }
}

// Global usage tracker instance
export const globalUsageTracker = new AIUsageTracker();