import {
  AIProvider,
  AIProviderConfig,
  AIProviderType,
} from './types';
import { OpenAIProvider } from './openai-provider';

/**
 * Factory class for creating AI provider instances
 */
export class AIProviderFactory {
  /**
   * Creates an AI provider instance based on configuration
   * @param config Provider configuration
   * @returns AI provider instance
   */
  static createProvider(config: AIProviderConfig): AIProvider {
    switch (config.provider) {
      case 'openai':
        return new OpenAIProvider(config);

      case 'anthropic':
        throw new Error('Anthropic provider not yet implemented');

      case 'local':
        throw new Error('Local provider not yet implemented');

      default:
        throw new Error(`Unsupported AI provider type: ${config.provider}`);
    }
  }

  /**
   * Creates a provider from environment variables
   * @returns AI provider instance
   */
  static createFromEnvironment(): AIProvider {
    const provider = (process.env.AI_PROVIDER as AIProviderType) || 'openai';
    const apiKey = process.env.AI_PROVIDER_API_KEY;
    const endpoint = process.env.AI_PROVIDER_ENDPOINT;
    const model = process.env.AI_PROVIDER_MODEL;

    if (!apiKey) {
      throw new Error('AI_PROVIDER_API_KEY environment variable is required');
    }

    if (!model) {
      throw new Error('AI_PROVIDER_MODEL environment variable is required');
    }

    const config: AIProviderConfig = {
      provider,
      apiKey,
      endpoint: endpoint || '',
      model,
    };

    return this.createProvider(config);
  }

  /**
   * Gets supported provider types
   * @returns Array of supported provider types
   */
  static getSupportedProviders(): AIProviderType[] {
    return ['openai']; // Will expand as we add more providers
  }
}