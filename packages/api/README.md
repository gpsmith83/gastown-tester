# Gastown Tester API

Express.js API server with GitHub OAuth authentication.

## Features

- GitHub OAuth 2.0 authentication
- Session management with Express sessions
- User persistence and management
- Protected route authentication middleware
- Comprehensive error handling

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your GitHub OAuth credentials
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Access the API:**
   - Health check: http://localhost:3001/health
   - Auth status: http://localhost:3001/auth/status
   - GitHub login: http://localhost:3001/auth/github

## Authentication Setup

### GitHub OAuth Configuration

1. Create a GitHub OAuth App:
   - Go to GitHub Settings > Developer settings > OAuth Apps
   - Click "New OAuth App"
   - Set Authorization callback URL: `http://localhost:3001/auth/github/callback`

2. Configure environment variables:
   ```bash
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   GITHUB_CALLBACK_URL=http://localhost:3001/auth/github/callback
   SESSION_SECRET=your_session_secret
   ```

## API Endpoints

### Authentication

#### `GET /auth/github`
Initiates GitHub OAuth flow.

**Response:**
- Redirects to GitHub for authentication
- Returns 501 if OAuth not configured

#### `GET /auth/github/callback`
GitHub OAuth callback endpoint.

**Response:**
- Redirects to frontend dashboard on success
- Redirects to `/auth/error` on failure

#### `GET /auth/status`
Check authentication status.

**Response:**
```json
{
  "success": true,
  "data": {
    "isAuthenticated": boolean,
    "user": User | null
  }
}
```

#### `GET /auth/user`
Get current authenticated user.

**Response:**
- 200: Returns user data if authenticated
- 401: Not authenticated

#### `POST /auth/logout`
Logout current user.

**Response:**
```json
{
  "success": true,
  "data": { "message": "Logged out successfully" }
}
```

#### `GET /auth/error`
Authentication error endpoint.

**Response:**
```json
{
  "success": false,
  "error": "Authentication failed"
}
```

### General

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-03-17T12:00:00.000Z"
  }
}
```

#### `GET /api/protected`
Example protected endpoint (requires authentication).

**Response:**
- 200: Returns protected data if authenticated
- 401: Authentication required

## Authentication Flow

1. User visits `/auth/github`
2. User is redirected to GitHub for authorization
3. GitHub redirects back to `/auth/github/callback`
4. Server exchanges code for user data
5. User is created/updated in storage
6. Session is established
7. User is redirected to frontend

## User Management

The API includes a `UserService` class for managing user data:

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}
```

Current implementation uses in-memory storage. For production, replace with database persistence.

## Middleware

### `requireAuth`
Protects routes requiring authentication.

```typescript
import { requireAuth } from './auth/middleware';

app.get('/protected', requireAuth, (req, res) => {
  // Route handler
});
```

### `optionalAuth`
Provides authentication context without requiring it.

## Testing

Run tests:
```bash
npm test
```

Tests include:
- UserService unit tests
- Authentication routes integration tests
- Error handling tests
- OAuth configuration tests

## Security Features

- Helmet for security headers
- CORS configuration for frontend access
- Session security with httpOnly cookies
- Secure cookies in production
- OAuth state validation

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3001) |
| `NODE_ENV` | Environment | No (default: development) |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | Yes (for OAuth) |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | Yes (for OAuth) |
| `GITHUB_CALLBACK_URL` | OAuth callback URL | Yes (for OAuth) |
| `SESSION_SECRET` | Session encryption key | Yes |

## Production Deployment

1. Set all required environment variables
2. Use secure session configuration
3. Set `NODE_ENV=production`
4. Configure proper CORS origins
5. Use HTTPS for OAuth callbacks
6. Replace in-memory user storage with database

## Architecture

```
src/
├── auth/
│   ├── index.ts          # Auth module exports
│   ├── passport.ts       # Passport configuration
│   ├── routes.ts         # Authentication routes
│   ├── user-service.ts   # User management
│   ├── middleware.ts     # Auth middleware
│   └── *.test.ts         # Test files
├── types/
│   └── passport.d.ts     # Type augmentations
└── index.ts              # Main server file
```

This implementation fulfills the requirements for GitHub OAuth session authentication with user persistence and session management.