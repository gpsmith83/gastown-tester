# Correlation Logging

This document describes the correlation logging system implemented in the Gastown Tester API for tracing requests and background jobs.

## Overview

The correlation logging system provides structured logging with unique identifiers that allow tracking related activities across API requests and background jobs. This makes the system diagnosable under real usage by enabling:

- **Request Tracing**: Every API request gets a unique correlation ID
- **Background Job Tracking**: Background jobs get unique job IDs and inherit correlation IDs from triggering requests
- **Structured Logging**: All log entries follow a consistent format with contextual metadata
- **Cross-Service Correlation**: Correlation IDs can be propagated across distributed services

## Components

### 1. Correlation Middleware (`src/middleware/correlation.ts`)

The correlation middleware:
- Generates a unique UUID for each incoming request
- Checks for existing `x-correlation-id` header for distributed tracing
- Attaches the correlation ID to the Express request object
- Returns the correlation ID in response headers

```typescript
// Usage is automatic for all routes
app.use(correlationMiddleware);
```

### 2. Structured Logger (`src/utils/logger.ts`)

The logger provides:
- **Base Logger**: Component-specific logging with consistent formatting
- **Request Logger**: Automatically includes correlation ID and user context
- **Job Logger**: Includes job ID and correlation context for background work

```typescript
import { apiLogger } from '../utils/logger';

// In route handlers
const logger = apiLogger.withRequest(req);
logger.info('Processing request', { operation: 'user_lookup', userId: 123 });

// For background jobs
const jobLogger = logger.withJob(jobId);
jobLogger.info('Job started', { operation: 'data_export' });
```

### 3. Job Service (`src/services/job-service.ts`)

Demonstrates background job correlation:
- Generates unique job IDs for tracking
- Inherits correlation IDs from triggering requests
- Provides structured logging throughout job lifecycle
- Example jobs: AI health checks, user data exports

### 4. Enhanced Route Logging (`src/routes/*.ts`)

Routes updated with correlation logging:
- **AI Routes**: Track AI provider calls with request correlation
- **Jobs Routes**: Demonstrate API-to-background-job correlation
- **Error Handling**: Structured error logging with correlation context

## Log Format

All logs follow this structured format:

```
[2026-03-17T13:17:54.123Z] INFO [req=a1b2c3d4, component=api, op=request_received]: GET /api/workspaces
[2026-03-17T13:17:54.125Z] INFO [req=a1b2c3d4, job=e5f6g7h8, component=job-service, op=job_start]: Starting job: user_data_export
[2026-03-17T13:17:55.234Z] INFO [req=a1b2c3d4, job=e5f6g7h8, component=job-service, op=job_complete]: Job completed successfully: user_data_export
```

### Log Context Fields

- `req`: First 8 characters of request correlation ID
- `job`: First 8 characters of job ID
- `component`: System component (api, database, ai-provider, etc.)
- `op`: Operation being performed (request_received, job_start, etc.)
- `userId`: User ID when available
- Additional context fields specific to the operation

## Usage Examples

### 1. API Request Tracing

```bash
# Request arrives
[2026-03-17T13:17:54.123Z] INFO [req=a1b2c3d4, component=api, op=request_received]: POST /api/ai/complete

# Request processing
[2026-03-17T13:17:54.125Z] INFO [req=a1b2c3d4, component=ai-provider, op=ai_completion]: AI completion request received
[2026-03-17T13:17:54.127Z] INFO [req=a1b2c3d4, component=ai-provider, op=ai_completion]: Sending request to AI provider

# Response
[2026-03-17T13:17:55.234Z] INFO [req=a1b2c3d4, component=ai-provider, op=ai_completion]: AI completion successful
```

### 2. Background Job Correlation

```bash
# API request triggers job
[2026-03-17T13:17:54.123Z] INFO [req=a1b2c3d4, component=api, op=trigger_export_job]: Triggering user data export job

# Background job execution
[2026-03-17T13:17:54.125Z] INFO [req=a1b2c3d4, job=e5f6g7h8, component=job-service, op=job_start]: Starting job: user_data_export
[2026-03-17T13:17:54.200Z] INFO [req=a1b2c3d4, job=e5f6g7h8, component=job-service, op=data_export]: Collecting user workspaces
[2026-03-17T13:17:54.350Z] INFO [req=a1b2c3d4, job=e5f6g7h8, component=job-service, op=data_export]: Collecting user projects
[2026-03-17T13:17:55.234Z] INFO [req=a1b2c3d4, job=e5f6g7h8, component=job-service, op=job_complete]: Job completed successfully: user_data_export

# API response
[2026-03-17T13:17:55.235Z] INFO [req=a1b2c3d4, component=api, op=trigger_export_job]: User data export job completed
```

### 3. Error Tracking

```bash
[2026-03-17T13:17:54.123Z] INFO [req=a1b2c3d4, component=api, op=request_received]: POST /api/ai/complete
[2026-03-17T13:17:54.125Z] ERROR [req=a1b2c3d4, component=ai-provider, op=ai_completion]: AI completion failed
[2026-03-17T13:17:54.126Z] ERROR [req=a1b2c3d4, component=api, op=request_error]: Request failed: AI provider unavailable
```

## Testing the System

### 1. Test API Request Correlation

```bash
# Make a request and check correlation ID in response
curl -H "Content-Type: application/json" http://localhost:3000/api/ai/health -v

# Response will include:
# x-correlation-id: a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6
```

### 2. Test Background Job Correlation

```bash
# Trigger a background job
curl -X POST -H "Content-Type: application/json" \
  -d '{"userId": "123"}' \
  http://localhost:3000/api/jobs/export-user-data

# Check running jobs
curl http://localhost:3000/api/jobs/running
```

### 3. Test Distributed Tracing

```bash
# Send request with existing correlation ID
curl -H "x-correlation-id: external-trace-123" \
     -H "Content-Type: application/json" \
     http://localhost:3000/api/ai/health

# Logs will show: [req=external-t, ...]
```

## Benefits

1. **Request Tracing**: Follow a specific user request through all system components
2. **Job Monitoring**: Track background job execution and relate to triggering requests
3. **Error Diagnosis**: Quickly identify all related log entries when investigating issues
4. **Performance Analysis**: Measure request/job duration and identify bottlenecks
5. **Distributed Tracing**: Correlate activities across multiple services
6. **Debugging**: Isolate logs for specific requests during development

## Integration with External Systems

The correlation ID system is designed to integrate with:

- **Log Aggregation**: Structured logs can be easily parsed by systems like ELK, Splunk
- **APM Tools**: Correlation IDs work with Application Performance Monitoring
- **Distributed Tracing**: Compatible with OpenTelemetry and similar systems
- **Error Tracking**: Integration with Sentry, Bugsnag for error correlation

## Environment Variables

- `NODE_ENV=development`: Enables debug-level logging
- `LOG_LEVEL`: Controls logging verbosity (if implemented)

The correlation logging system provides a solid foundation for observability and debugging in production environments.