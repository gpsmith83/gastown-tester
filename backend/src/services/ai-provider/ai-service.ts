import {
  AIProvider,
  AIProviderType,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderError,
} from './types';
import { AIProviderFactory } from './provider-factory';
import { AIUsageTracker, globalUsageTracker } from './usage-tracker';

/**
 * Main AI service that provides a unified interface to AI providers
 * This is the primary entry point for the application to interact with AI providers
 */
export class AIService {
  private provider: AIProvider | null = null;
  private usageTracker: AIUsageTracker;

  constructor(usageTracker?: AIUsageTracker) {
    this.usageTracker = usageTracker || globalUsageTracker;
  }

  /**
   * Initializes the AI service with a provider
   * @param provider AI provider instance or 'auto' to create from environment
   */
  async initialize(provider: AIProvider | 'auto' = 'auto'): Promise<void> {
    if (provider === 'auto') {
      try {
        this.provider = AIProviderFactory.createFromEnvironment();
        console.log(`[AI_SERVICE] Initialized with ${this.provider.type} provider (${this.provider.model})`);
      } catch (error) {
        console.error('[AI_SERVICE] Failed to initialize from environment:', error);
        throw new Error(`Failed to initialize AI provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      this.provider = provider;
      console.log(`[AI_SERVICE] Initialized with ${provider.type} provider (${provider.model})`);
    }

    // Test the provider
    const isHealthy = await this.provider.healthCheck();
    if (!isHealthy) {
      console.warn('[AI_SERVICE] Provider health check failed - provider may not be working correctly');
    }
  }

  /**
   * Sends a completion request to the configured AI provider
   * @param request Completion request
   * @param context Optional context (userId, projectId) for usage tracking
   * @returns Promise resolving to AI response
   */
  async complete(
    request: AICompletionRequest,
    context?: { userId?: string; projectId?: string }
  ): Promise<AICompletionResponse> {
    if (!this.provider) {
      throw new Error('AI service not initialized. Call initialize() first.');
    }

    const startTime = Date.now();
    let response: AICompletionResponse | null = null;
    let error: Error | null = null;

    try {
      response = await this.provider.complete(request);
      return response;
    } catch (err) {
      error = err instanceof Error ? err : new Error('Unknown error');
      throw error;
    } finally {
      const endTime = Date.now();

      // Record usage metadata
      const metadata = this.usageTracker.createUsageMetadata(
        this.provider.type,
        this.provider.model,
        request,
        response,
        startTime,
        endTime,
        error,
        context?.userId,
        context?.projectId,
        'configured-endpoint' // We could expose endpoint from provider if needed
      );

      this.usageTracker.recordUsage(metadata);
    }
  }

  /**
   * Checks if the AI service is initialized and healthy
   * @returns Promise resolving to true if service is ready
   */
  async isHealthy(): Promise<boolean> {
    if (!this.provider) {
      return false;
    }

    try {
      return await this.provider.healthCheck();
    } catch (error) {
      console.error('[AI_SERVICE] Health check failed:', error);
      return false;
    }
  }

  /**
   * Gets the current provider information
   * @returns Provider info or null if not initialized
   */
  getProviderInfo(): { type: AIProviderType; model: string } | null {
    if (!this.provider) {
      return null;
    }

    return {
      type: this.provider.type,
      model: this.provider.model,
    };
  }

  /**
   * Gets usage statistics
   * @returns Usage statistics from the tracker
   */
  getUsageStats() {
    return this.usageTracker.getUsageStats();
  }

  /**
   * Gets recent usage entries
   * @param limit Number of entries to return
   * @returns Recent usage metadata
   */
  getRecentUsage(limit?: number) {
    return this.usageTracker.getRecentUsage(limit);
  }
}

// Global AI service instance
export const globalAIService = new AIService();