// AI Provider abstraction types and interfaces

/**
 * Supported AI provider types
 */
export type AIProviderType = 'openai' | 'anthropic' | 'local';

/**
 * Configuration for AI provider
 */
export interface AIProviderConfig {
  provider: AIProviderType;
  apiKey: string;
  endpoint: string;
  model: string;
}

/**
 * Request payload for AI completion
 */
export interface AICompletionRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

/**
 * Response from AI completion
 */
export interface AICompletionResponse {
  id: string;
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'error';
}

/**
 * Metadata captured for each AI provider call
 */
export interface AIProviderUsageMetadata {
  id: string;
  provider: AIProviderType;
  model: string;
  timestamp: Date;
  requestTokens: number;
  responseTokens: number;
  totalTokens: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  userId?: string;
  projectId?: string;
  endpoint: string;
}

/**
 * Base AI Provider interface
 * All AI provider implementations must implement this interface
 */
export interface AIProvider {
  /**
   * The type of provider (openai, anthropic, etc.)
   */
  readonly type: AIProviderType;

  /**
   * The configured model for this provider
   */
  readonly model: string;

  /**
   * Send a completion request to the AI provider
   * @param request The completion request
   * @returns Promise resolving to the AI response
   */
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;

  /**
   * Test if the provider is properly configured and accessible
   * @returns Promise resolving to true if provider is healthy
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Error thrown by AI providers
 */
export class AIProviderError extends Error {
  public readonly provider: AIProviderType;
  public readonly code: string;
  public readonly originalError?: any;

  constructor(
    provider: AIProviderType,
    code: string,
    message: string,
    originalError?: any
  ) {
    super(message);
    this.name = 'AIProviderError';
    this.provider = provider;
    this.code = code;
    this.originalError = originalError;
  }
}