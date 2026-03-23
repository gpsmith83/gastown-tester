import { AIProviderAuditModel } from '../models/AIProviderAudit';
import { CreateAIProviderAuditRequest } from '../models/types';
import { AICompletionRequest, AICompletionResponse } from './ai-provider/types';

/**
 * Service for AI Provider audit logging that wraps AI provider calls
 * Implements B-706: Full provider payload audit retention and retrieval
 */
export class AIAuditService {
  /**
   * Execute AI completion with full audit logging
   */
  static async executeWithAudit(
    aiProviderFunction: () => Promise<AICompletionResponse>,
    auditContext: {
      requirement_id?: string;
      user_id?: string;
      provider_type: string;
      provider_model?: string;
      provider_endpoint?: string;
      correlation_id?: string;
      job_id?: string;
      session_context?: any;
      request_payload: AICompletionRequest;
      audit_level?: 'full' | 'metadata-only' | 'disabled';
      retention_policy?: 'standard' | 'extended' | 'minimal';
    }
  ): Promise<{
    response: AICompletionResponse;
    audit_id: string;
  }> {
    const startTime = Date.now();

    // Skip audit logging if disabled
    if (auditContext.audit_level === 'disabled') {
      const response = await aiProviderFunction();
      return { response, audit_id: '' };
    }

    // Determine what to log based on audit level
    const requestPayload = auditContext.audit_level === 'metadata-only'
      ? {
          message_count: auditContext.request_payload.messages?.length || 0,
          max_tokens: auditContext.request_payload.maxTokens,
          temperature: auditContext.request_payload.temperature,
          stream: auditContext.request_payload.stream
        }
      : auditContext.request_payload;

    // Create initial audit record
    const auditData: CreateAIProviderAuditRequest = {
      requirement_id: auditContext.requirement_id,
      user_id: auditContext.user_id,
      provider_type: auditContext.provider_type,
      provider_model: auditContext.provider_model,
      provider_endpoint: auditContext.provider_endpoint,
      correlation_id: auditContext.correlation_id,
      job_id: auditContext.job_id,
      session_context: auditContext.session_context,
      request_payload: requestPayload,
      audit_level: auditContext.audit_level || 'full',
      retention_policy: auditContext.retention_policy || 'standard',
      request_timestamp: new Date(),
      is_successful: false // Will be updated on completion
    };

    const audit = await AIProviderAuditModel.create(auditData);

    let response: AICompletionResponse | null = null;
    let error: Error | null = null;

    try {
      // Execute the AI provider call
      response = await aiProviderFunction();

      // Calculate metrics
      const endTime = Date.now();
      const latency = endTime - startTime;

      // Determine response payload to log
      const responsePayload = auditContext.audit_level === 'metadata-only'
        ? {
            content_length: response.content?.length || 0,
            model: response.model,
            usage: response.usage,
            finish_reason: response.finishReason
          }
        : response;

      // Update audit record with successful completion
      await AIProviderAuditModel.update(audit.id, {
        response_payload: responsePayload,
        response_status: 200, // Successful AI response
        request_tokens: response.usage?.promptTokens,
        response_tokens: response.usage?.completionTokens,
        total_tokens: response.usage?.totalTokens,
        latency_ms: latency,
        is_successful: true,
        response_timestamp: new Date()
      });

      return { response, audit_id: audit.id };

    } catch (err) {
      error = err instanceof Error ? err : new Error('Unknown error');

      const endTime = Date.now();
      const latency = endTime - startTime;

      // Update audit record with error
      await AIProviderAuditModel.update(audit.id, {
        response_status: 500, // Error status
        latency_ms: latency,
        is_successful: false,
        error_type: error.name || 'UnknownError',
        error_message: error.message,
        error_details: {
          stack: error.stack,
          timestamp: new Date().toISOString()
        },
        response_timestamp: new Date()
      });

      throw error;
    }
  }

  /**
   * Log a standalone audit entry (for manual tracking)
   */
  static async logAuditEntry(data: CreateAIProviderAuditRequest): Promise<string> {
    const audit = await AIProviderAuditModel.create(data);
    return audit.id;
  }

  /**
   * Get audit history for a requirement
   */
  static async getRequirementAuditHistory(
    requirement_id: string,
    includePayloads: boolean = false,
    limit: number = 50
  ) {
    return AIProviderAuditModel.findByRequirementId(requirement_id, includePayloads, limit);
  }

  /**
   * Get audit trail by correlation ID
   */
  static async getCorrelationAuditTrail(
    correlation_id: string,
    includePayloads: boolean = false
  ) {
    return AIProviderAuditModel.findByCorrelationId(correlation_id, includePayloads);
  }

  /**
   * Get usage statistics with privacy protection
   */
  static async getUsageStatistics(filters?: {
    requirement_id?: string;
    user_id?: string;
    provider_type?: string;
    date_range?: { start: Date; end: Date };
  }) {
    return AIProviderAuditModel.getUsageStats(filters);
  }

  /**
   * Get audit summaries (aggregated data)
   */
  static async getAuditSummaries(filters?: {
    requirement_id?: string;
    user_id?: string;
    provider_type?: string;
    start_date?: Date;
    end_date?: Date;
    limit?: number;
    offset?: number;
  }) {
    return AIProviderAuditModel.getSummaries(filters);
  }

  /**
   * Sanitize AI response for ordinary logging (removes sensitive content)
   */
  static sanitizeForLogging(response: AICompletionResponse): {
    id: string;
    model: string;
    usage: any;
    finishReason: string;
    content_length: number;
    timestamp: string;
  } {
    return {
      id: response.id,
      model: response.model,
      usage: response.usage,
      finishReason: response.finishReason,
      content_length: response.content?.length || 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Sanitize AI request for ordinary logging (removes sensitive content)
   */
  static sanitizeRequestForLogging(request: AICompletionRequest): {
    message_count: number;
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
    total_characters: number;
  } {
    return {
      message_count: request.messages?.length || 0,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      stream: request.stream,
      total_characters: request.messages?.reduce((sum, msg) => sum + msg.content.length, 0) || 0
    };
  }
}