import {
  AIProvider,
  AIProviderType,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderConfig,
  AIProviderError,
} from './types';

/**
 * OpenAI provider implementation
 * Implements the AIProvider interface for OpenAI's API
 */
export class OpenAIProvider implements AIProvider {
  public readonly type: AIProviderType = 'openai';
  public readonly model: string;
  private readonly apiKey: string;
  private readonly endpoint: string;

  constructor(config: AIProviderConfig) {
    if (config.provider !== 'openai') {
      throw new Error('OpenAIProvider requires provider type "openai"');
    }

    if (!config.apiKey) {
      throw new Error('OpenAI provider requires an API key');
    }

    if (!config.model) {
      throw new Error('OpenAI provider requires a model');
    }

    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint || 'https://api.openai.com/v1';
    this.model = config.model;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const url = `${this.endpoint}/chat/completions`;

    const payload = {
      model: this.model,
      messages: request.messages,
      max_tokens: request.maxTokens || 1000,
      temperature: request.temperature || 0.7,
      stream: request.stream || false,
    };

    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new AIProviderError(
          'openai',
          `HTTP_${response.status}`,
          errorData.error?.message || `HTTP error ${response.status}`,
          errorData
        );
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0]) {
        throw new AIProviderError(
          'openai',
          'INVALID_RESPONSE',
          'No choices in response from OpenAI',
          data
        );
      }

      const choice = data.choices[0];
      const content = choice.message?.content || '';

      return {
        id: data.id,
        content,
        model: data.model,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        finishReason: this.mapFinishReason(choice.finish_reason),
      };
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }

      // Handle network errors, parsing errors, etc.
      throw new AIProviderError(
        'openai',
        'REQUEST_FAILED',
        error instanceof Error ? error.message : 'Unknown error occurred',
        error
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check with minimal token usage
      const response = await this.complete({
        messages: [{ role: 'user', content: 'Say "OK"' }],
        maxTokens: 5,
        temperature: 0,
      });

      return response.content.trim().toLowerCase().includes('ok');
    } catch (error) {
      console.error('OpenAI health check failed:', error);
      return false;
    }
  }

  /**
   * Maps OpenAI finish reasons to our standard format
   */
  private mapFinishReason(reason: string): AICompletionResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      case 'tool_calls':
        return 'tool_calls';
      default:
        return 'error';
    }
  }
}