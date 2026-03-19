# Workspace Security and Access Control Guide

This document outlines the security measures implemented in the Gastown Tester application to ensure proper workspace isolation and permission control.

## Overview

The application implements multi-tenant workspace isolation using a hierarchical permission model:

```
Workspaces (Tenant Boundaries)
├── Projects (Scoped to workspace)
└── Requirements (Scoped to project)
```

## Access Control Architecture

### 1. Authentication Layer
- **GitHub OAuth**: All users must authenticate via GitHub
- **Session Management**: Secure session-based authentication
- **Rate Limiting**: Separate limits for auth endpoints

### 2. Authorization Layer
- **Workspace Membership**: Users must be members of a workspace to access its resources
- **Role-Based Permissions**: Different roles (owner, admin, member) have different capabilities
- **Resource-Level Checks**: Each API endpoint validates access to specific resources

### 3. Tenant Isolation Layer
- **Cross-Workspace Protection**: Prevents access to resources from other workspaces
- **Resource Relationship Validation**: Ensures projects belong to specified workspaces
- **Input Validation**: Prevents injection and traversal attacks

## Security Middleware

### Access Control Middleware (`src/middleware/accessControl.ts`)

#### `requireWorkspaceAccess`
Validates that the authenticated user is a member of the specified workspace.

```typescript
// Usage: Protect workspace-specific endpoints
router.get('/workspaces/:id', requireWorkspaceAccess, handler);
```

#### `requireProjectAccess`
Validates that the user has access to a project via workspace membership.

```typescript
// Usage: Protect project-specific endpoints
router.get('/projects/:id', requireProjectAccess, handler);
```

#### `requireRequirementAccess`
Validates that the user has access to a requirement via project/workspace membership.

```typescript
// Usage: Protect requirement-specific endpoints
router.get('/requirements/:id', requireRequirementAccess, handler);
```

#### `preventCrossWorkspaceAccess`
Validates that resources belong to the correct workspace/project hierarchy.

```typescript
// Usage: Prevent cross-tenant access attempts
router.post('/projects', preventCrossWorkspaceAccess, handler);
```

#### Role-Based Middleware
- `requireWorkspaceOwnership`: Only workspace owners
- `requireWorkspaceAdmin`: Workspace owners and admins
- `requireProjectOwnership`: Only project owners
- `requireRequirementAuthorship`: Only requirement authors

### Security Middleware (`src/middleware/security.ts`)

#### Headers and CSP
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **Content-Security-Policy**: Restricts resource loading
- **HSTS**: Forces HTTPS in production

#### Rate Limiting
- **General API**: 1000 requests per 15 minutes
- **Authentication**: 50 requests per 15 minutes
- **Create Operations**: 50 requests per 5 minutes
- **Update Operations**: 100 requests per 5 minutes

#### Input Protection
- **Sanitization**: Removes control characters and malicious input
- **Size Limits**: Prevents large payload attacks
- **Pattern Detection**: Blocks suspicious input patterns

## Database Security

### Schema Design
- **Foreign Key Constraints**: Ensures referential integrity
- **Cascading Deletes**: Maintains data consistency
- **Indexes**: Optimized for security queries

### Access Patterns
All database queries use parameterized statements to prevent SQL injection:

```typescript
// ✅ Secure - parameterized query
const result = await db.query('SELECT * FROM projects WHERE id = $1', [projectId]);

// ❌ Insecure - string concatenation
const result = await db.query(`SELECT * FROM projects WHERE id = '${projectId}'`);
```

## API Endpoint Security

### Workspace Routes (`/api/workspaces`)
- `GET /` - Lists user's workspaces (no additional checks needed)
- `POST /` - Create workspace (rate limited)
- `GET /:id` - Requires workspace access
- `PUT /:id` - Requires workspace admin role
- `DELETE /:id` - Requires workspace ownership

### Project Routes (`/api/projects`)
- `GET /` - Lists user's projects across all workspaces
- `GET /workspace/:workspaceId` - Requires workspace access
- `POST /` - Requires workspace access + cross-workspace validation
- `GET /:id` - Requires project access
- `PUT /:id` - Requires project access
- `PATCH /:id/status` - Requires project ownership
- `DELETE /:id` - Requires project ownership

### Requirement Routes (`/api/requirements`)
- `GET /` - Lists user's requirements across all projects
- `GET /project/:projectId` - Requires project access
- `POST /` - Requires project access + cross-workspace validation
- `GET /:id` - Requires requirement access
- `PUT /:id` - Requires requirement access
- `PATCH /:id/status` - Requires requirement access
- `DELETE /:id` - Requires requirement authorship

## Security Testing

### Test Coverage
The application includes comprehensive access control tests in `src/tests/access-control.test.ts`:

- ✅ Workspace access control
- ✅ Project access control
- ✅ Requirement access control
- ✅ Cross-workspace access prevention
- ✅ Role-based permission enforcement

### Manual Testing Checklist

#### Authentication Tests
- [ ] Unauthenticated requests are blocked
- [ ] Invalid sessions are rejected
- [ ] Rate limits prevent brute force attacks

#### Workspace Isolation Tests
- [ ] User A cannot access User B's workspace
- [ ] Cross-workspace project access is blocked
- [ ] Cross-workspace requirement access is blocked

#### Permission Tests
- [ ] Regular members cannot delete workspaces
- [ ] Non-owners cannot change project status
- [ ] Non-authors cannot delete requirements

#### Security Headers Tests
- [ ] CSP headers are present
- [ ] Frame protection is enabled
- [ ] MIME sniffing is disabled

## Development Guidelines

### Adding New Endpoints
When adding new API endpoints:

1. **Add Authentication**: Use `requireAuth` middleware
2. **Add Access Control**: Use appropriate access control middleware
3. **Add Rate Limiting**: Choose appropriate rate limit for the operation
4. **Validate Input**: Ensure all input is properly validated
5. **Test Security**: Add tests for both authorized and unauthorized access

### Example: Adding a New Project Endpoint
```typescript
import {
  requireAuth,
  requireProjectAccess,
  requireProjectOwnership
} from '../middleware';
import { updateRateLimit } from '../middleware/security';

// Secure endpoint example
router.patch(
  '/projects/:id/archive',
  requireAuth,                    // 1. Require authentication
  updateRateLimit,               // 2. Apply rate limiting
  requireProjectAccess,         // 3. Check project access
  requireProjectOwnership,      // 4. Check ownership for sensitive operation
  async (req, res) => {
    // 5. Implementation with proper error handling
    // Input validation already handled by middleware
  }
);
```

### Security Best Practices

#### Input Validation
- Always validate and sanitize user input
- Use parameterized queries for database operations
- Implement request size limits
- Check for malicious patterns

#### Error Handling
- Don't expose internal implementation details
- Log security events for monitoring
- Return consistent error messages
- Use correlation IDs for tracking

#### Resource Protection
- Always check permissions before database queries
- Validate resource relationships (workspace → project → requirement)
- Use role-based access for sensitive operations
- Implement proper audit logging

## Monitoring and Alerting

### Security Events to Monitor
- Failed authentication attempts
- Cross-workspace access attempts
- Permission denied events
- Rate limit violations
- Suspicious input patterns

### Log Analysis
Security events are logged with correlation IDs for tracking:

```
[SECURITY] 2024-01-01T00:00:00Z 192.168.1.1 POST /api/projects UserAgent: ...
```

## Incident Response

### If Security Breach Suspected
1. **Immediate**: Review application logs for the correlation ID
2. **Investigate**: Check database for unauthorized access patterns
3. **Contain**: Consider temporarily blocking suspicious IPs
4. **Document**: Record findings and remediation steps

### Common Security Issues and Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Cross-workspace access | User accessing other workspace data | Check access control middleware implementation |
| Rate limit bypass | Unusual request patterns | Review rate limiting configuration |
| Input injection | Malformed data in logs | Verify input sanitization is working |
| Session hijacking | Unexpected user behavior | Check session security configuration |

## Future Enhancements

### Planned Security Improvements
- [ ] Two-factor authentication support
- [ ] API key authentication for integrations
- [ ] Advanced threat detection
- [ ] Automated security scanning
- [ ] Enhanced audit logging
- [ ] IP allowlisting for sensitive operations

### Monitoring Improvements
- [ ] Real-time security dashboards
- [ ] Automated alerting for security events
- [ ] Integration with security information and event management (SIEM)
- [ ] Regular security assessments

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

---

**Last Updated**: 2024-01-01
**Version**: 1.0
**Next Review**: 2024-04-01