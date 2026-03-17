import { db } from '../config/database';
import { AIProviderAudit, CreateAIProviderAuditRequest, AIProviderAuditSummary, AIProviderAuditQuery } from './types';

export class AIProviderAuditModel {
  // Create a new audit entry
  static async create(data: CreateAIProviderAuditRequest): Promise<AIProviderAudit> {
    const result = await db.query(
      `INSERT INTO ai_provider_audits (
        requirement_id, user_id, provider_type, provider_model, provider_endpoint,
        correlation_id, job_id, session_context, request_payload, response_payload,
        response_status, request_tokens, response_tokens, total_tokens, latency_ms,
        audit_level, retention_policy, is_successful, error_type, error_message,
        error_details, request_timestamp, response_timestamp
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
       RETURNING *`,
      [
        data.requirement_id || null,
        data.user_id || null,
        data.provider_type,
        data.provider_model || null,
        data.provider_endpoint || null,
        data.correlation_id || null,
        data.job_id || null,
        data.session_context ? JSON.stringify(data.session_context) : null,
        JSON.stringify(data.request_payload),
        data.response_payload ? JSON.stringify(data.response_payload) : null,
        data.response_status || null,
        data.request_tokens || null,
        data.response_tokens || null,
        data.total_tokens || null,
        data.latency_ms || null,
        data.audit_level || 'full',
        data.retention_policy || 'standard',
        data.is_successful ?? false,
        data.error_type || null,
        data.error_message || null,
        data.error_details ? JSON.stringify(data.error_details) : null,
        data.request_timestamp || new Date(),
        data.response_timestamp || null
      ]
    );

    return result.rows[0];
  }

  // Get audit entry by ID
  static async findById(id: string, includePayloads: boolean = false): Promise<AIProviderAudit | null> {
    const selectFields = includePayloads
      ? '*'
      : `id, requirement_id, user_id, provider_type, provider_model, provider_endpoint,
         correlation_id, job_id, response_status, request_tokens, response_tokens,
         total_tokens, latency_ms, audit_level, retention_policy, is_successful,
         error_type, error_message, request_timestamp, response_timestamp, created_at, updated_at`;

    const result = await db.query(
      `SELECT ${selectFields} FROM ai_provider_audits WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  // Update audit entry (typically for completion)
  static async update(id: string, data: Partial<CreateAIProviderAuditRequest>): Promise<AIProviderAudit | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.response_payload !== undefined) {
      fields.push(`response_payload = $${paramIndex++}`);
      values.push(data.response_payload ? JSON.stringify(data.response_payload) : null);
    }

    if (data.response_status !== undefined) {
      fields.push(`response_status = $${paramIndex++}`);
      values.push(data.response_status);
    }

    if (data.response_tokens !== undefined) {
      fields.push(`response_tokens = $${paramIndex++}`);
      values.push(data.response_tokens);
    }

    if (data.total_tokens !== undefined) {
      fields.push(`total_tokens = $${paramIndex++}`);
      values.push(data.total_tokens);
    }

    if (data.latency_ms !== undefined) {
      fields.push(`latency_ms = $${paramIndex++}`);
      values.push(data.latency_ms);
    }

    if (data.is_successful !== undefined) {
      fields.push(`is_successful = $${paramIndex++}`);
      values.push(data.is_successful);
    }

    if (data.error_type !== undefined) {
      fields.push(`error_type = $${paramIndex++}`);
      values.push(data.error_type);
    }

    if (data.error_message !== undefined) {
      fields.push(`error_message = $${paramIndex++}`);
      values.push(data.error_message);
    }

    if (data.error_details !== undefined) {
      fields.push(`error_details = $${paramIndex++}`);
      values.push(data.error_details ? JSON.stringify(data.error_details) : null);
    }

    if (data.response_timestamp !== undefined) {
      fields.push(`response_timestamp = $${paramIndex++}`);
      values.push(data.response_timestamp);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await db.query(
      `UPDATE ai_provider_audits SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Find audit entries with filters
  static async findWithFilters(query: AIProviderAuditQuery): Promise<{
    audits: AIProviderAudit[];
    total: number;
  }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (query.requirement_id) {
      conditions.push(`requirement_id = $${paramIndex++}`);
      values.push(query.requirement_id);
    }

    if (query.user_id) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(query.user_id);
    }

    if (query.provider_type) {
      conditions.push(`provider_type = $${paramIndex++}`);
      values.push(query.provider_type);
    }

    if (query.provider_model) {
      conditions.push(`provider_model = $${paramIndex++}`);
      values.push(query.provider_model);
    }

    if (query.correlation_id) {
      conditions.push(`correlation_id = $${paramIndex++}`);
      values.push(query.correlation_id);
    }

    if (query.job_id) {
      conditions.push(`job_id = $${paramIndex++}`);
      values.push(query.job_id);
    }

    if (query.is_successful !== undefined) {
      conditions.push(`is_successful = $${paramIndex++}`);
      values.push(query.is_successful);
    }

    if (query.start_date) {
      conditions.push(`request_timestamp >= $${paramIndex++}`);
      values.push(query.start_date);
    }

    if (query.end_date) {
      conditions.push(`request_timestamp <= $${paramIndex++}`);
      values.push(query.end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM ai_provider_audits ${whereClause}`,
      values
    );

    const total = parseInt(countResult.rows[0].total);

    // Select fields based on payload inclusion
    const selectFields = query.include_payloads === true
      ? '*'
      : `id, requirement_id, user_id, provider_type, provider_model, provider_endpoint,
         correlation_id, job_id, response_status, request_tokens, response_tokens,
         total_tokens, latency_ms, audit_level, retention_policy, is_successful,
         error_type, error_message, request_timestamp, response_timestamp, created_at, updated_at`;

    // Add pagination
    if (query.limit) {
      values.push(query.limit);
      paramIndex++;
    }

    if (query.offset) {
      values.push(query.offset);
      paramIndex++;
    }

    const limitClause = query.limit ? `LIMIT $${paramIndex - (query.offset ? 2 : 1)}` : '';
    const offsetClause = query.offset ? `OFFSET $${paramIndex - 1}` : '';

    // Get results
    const result = await db.query(
      `SELECT ${selectFields} FROM ai_provider_audits
       ${whereClause}
       ORDER BY request_timestamp DESC
       ${limitClause} ${offsetClause}`,
      values
    );

    return {
      audits: result.rows,
      total
    };
  }

  // Get audits by requirement ID (for requirement audit history)
  static async findByRequirementId(
    requirement_id: string,
    includePayloads: boolean = false,
    limit: number = 50
  ): Promise<AIProviderAudit[]> {
    const selectFields = includePayloads
      ? '*'
      : `id, requirement_id, user_id, provider_type, provider_model, provider_endpoint,
         correlation_id, job_id, response_status, request_tokens, response_tokens,
         total_tokens, latency_ms, audit_level, retention_policy, is_successful,
         error_type, error_message, request_timestamp, response_timestamp, created_at, updated_at`;

    const result = await db.query(
      `SELECT ${selectFields} FROM ai_provider_audits
       WHERE requirement_id = $1
       ORDER BY request_timestamp DESC
       LIMIT $2`,
      [requirement_id, limit]
    );

    return result.rows;
  }

  // Get audits by correlation ID (for request tracing)
  static async findByCorrelationId(
    correlation_id: string,
    includePayloads: boolean = false
  ): Promise<AIProviderAudit[]> {
    const selectFields = includePayloads
      ? '*'
      : `id, requirement_id, user_id, provider_type, provider_model, provider_endpoint,
         correlation_id, job_id, response_status, request_tokens, response_tokens,
         total_tokens, latency_ms, audit_level, retention_policy, is_successful,
         error_type, error_message, request_timestamp, response_timestamp, created_at, updated_at`;

    const result = await db.query(
      `SELECT ${selectFields} FROM ai_provider_audits
       WHERE correlation_id = $1
       ORDER BY request_timestamp DESC`,
      [correlation_id]
    );

    return result.rows;
  }

  // Get audit summaries with filters
  static async getSummaries(filters: {
    requirement_id?: string;
    user_id?: string;
    provider_type?: string;
    provider_model?: string;
    start_date?: Date;
    end_date?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    summaries: AIProviderAuditSummary[];
    total: number;
  }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.requirement_id) {
      conditions.push(`requirement_id = $${paramIndex++}`);
      values.push(filters.requirement_id);
    }

    if (filters.user_id) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(filters.user_id);
    }

    if (filters.provider_type) {
      conditions.push(`provider_type = $${paramIndex++}`);
      values.push(filters.provider_type);
    }

    if (filters.provider_model) {
      conditions.push(`provider_model = $${paramIndex++}`);
      values.push(filters.provider_model);
    }

    if (filters.start_date) {
      conditions.push(`date_bucket >= $${paramIndex++}`);
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      conditions.push(`date_bucket <= $${paramIndex++}`);
      values.push(filters.end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM ai_provider_audit_summaries ${whereClause}`,
      values
    );

    const total = parseInt(countResult.rows[0].total);

    // Add pagination
    if (filters.limit) {
      values.push(filters.limit);
      paramIndex++;
    }

    if (filters.offset) {
      values.push(filters.offset);
      paramIndex++;
    }

    const limitClause = filters.limit ? `LIMIT $${paramIndex - (filters.offset ? 2 : 1)}` : '';
    const offsetClause = filters.offset ? `OFFSET $${paramIndex - 1}` : '';

    // Get results
    const result = await db.query(
      `SELECT * FROM ai_provider_audit_summaries
       ${whereClause}
       ORDER BY date_bucket DESC
       ${limitClause} ${offsetClause}`,
      values
    );

    return {
      summaries: result.rows,
      total
    };
  }

  // Check if user can access audit records (via project/requirement access)
  static async canUserAccess(audit_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM ai_provider_audits apa
       LEFT JOIN requirements r ON apa.requirement_id = r.id
       LEFT JOIN projects p ON r.project_id = p.id
       LEFT JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
       WHERE apa.id = $1 AND (apa.user_id = $2 OR wm.user_id = $2)`,
      [audit_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Get usage statistics
  static async getUsageStats(filters?: {
    requirement_id?: string;
    user_id?: string;
    provider_type?: string;
    date_range?: { start: Date; end: Date };
  }): Promise<{
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    total_tokens: number;
    avg_latency_ms: number;
    providers: { provider_type: string; count: number; success_rate: number }[];
    daily_usage: { date: Date; requests: number; tokens: number }[];
  }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.requirement_id) {
      conditions.push(`requirement_id = $${paramIndex++}`);
      values.push(filters.requirement_id);
    }

    if (filters?.user_id) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(filters.user_id);
    }

    if (filters?.provider_type) {
      conditions.push(`provider_type = $${paramIndex++}`);
      values.push(filters.provider_type);
    }

    if (filters?.date_range) {
      conditions.push(`request_timestamp >= $${paramIndex++}`);
      conditions.push(`request_timestamp <= $${paramIndex++}`);
      values.push(filters.date_range.start, filters.date_range.end);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get overall stats
    const overallResult = await db.query(
      `SELECT
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE is_successful = true) as successful_requests,
        COUNT(*) FILTER (WHERE is_successful = false) as failed_requests,
        SUM(COALESCE(total_tokens, 0)) as total_tokens,
        AVG(COALESCE(latency_ms, 0)) as avg_latency_ms
       FROM ai_provider_audits ${whereClause}`,
      values
    );

    // Get provider breakdown
    const providerResult = await db.query(
      `SELECT
        provider_type,
        COUNT(*) as count,
        ROUND(COUNT(*) FILTER (WHERE is_successful = true) * 100.0 / COUNT(*), 2) as success_rate
       FROM ai_provider_audits ${whereClause}
       GROUP BY provider_type
       ORDER BY count DESC`,
      values
    );

    // Get daily usage
    const dailyResult = await db.query(
      `SELECT
        DATE(request_timestamp) as date,
        COUNT(*) as requests,
        SUM(COALESCE(total_tokens, 0)) as tokens
       FROM ai_provider_audits ${whereClause}
       GROUP BY DATE(request_timestamp)
       ORDER BY date DESC
       LIMIT 30`,
      values
    );

    const overall = overallResult.rows[0];
    return {
      total_requests: parseInt(overall.total_requests || '0'),
      successful_requests: parseInt(overall.successful_requests || '0'),
      failed_requests: parseInt(overall.failed_requests || '0'),
      total_tokens: parseInt(overall.total_tokens || '0'),
      avg_latency_ms: parseFloat(overall.avg_latency_ms || '0'),
      providers: providerResult.rows.map(row => ({
        provider_type: row.provider_type,
        count: parseInt(row.count),
        success_rate: parseFloat(row.success_rate || '0')
      })),
      daily_usage: dailyResult.rows.map(row => ({
        date: row.date,
        requests: parseInt(row.requests),
        tokens: parseInt(row.tokens)
      }))
    };
  }
}