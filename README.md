# Gastown Tester

Full-stack web application with Angular frontend and Express API backend.

## Project Structure

```
├── backend/          # Express.js API server
├── frontend/         # Angular application
├── package.json      # Root package.json for monorepo scripts
└── README.md         # This file
```

## Quick Start

### Option 1: Docker Compose (Recommended)
Complete environment with database included:

```bash
# Bootstrap and start with Docker
npm run bootstrap
npm run docker:up
```

### Option 2: Native Development
Run services directly on your machine:

**Prerequisites:**
- Node.js >= 18.0.0
- npm
- PostgreSQL 15+ (for data persistence)
- Redis 7+ (optional, for job processing)

**Installation:**
```bash
npm run install:all
```

### Development
```bash
# Start both frontend and backend in development mode
npm run dev

# Or start individually:
npm run dev:backend    # Express API on http://localhost:3000
npm run dev:frontend   # Angular app on http://localhost:4200
```

**Access Points:**
- Frontend: http://localhost:4200 (Angular development server)
- API: http://localhost:3001
- API Health: http://localhost:3001/health

## Architecture

**Monorepo Structure:**
- `backend/` - Express.js REST API server (primary)
- `frontend/` - Angular application (primary)
- `packages/shared` - Common types and utilities
- `packages/api` - Alternative Express.js API server
- `packages/frontend` - Alternative React frontend (Vite)
- `packages/worker` - Background job processing

**Technology Stack:**
- **Language:** TypeScript
- **Package Manager:** npm workspaces
- **API Framework:** Express.js
- **Frontend Framework:** Angular (primary) + React/Vite (alternative)
- **Database:** PostgreSQL 15
- **Cache/Queue:** Redis 7
- **Container:** Docker Compose
- **Testing:** Jest + Jasmine/Karma
- **Linting:** ESLint
- **Build:** TypeScript compiler + Angular CLI

### Build
```bash
# Build both applications
npm run build

# Or build individually:
npm run build:backend
npm run build:frontend
```

### Production
```bash
# Start backend in production mode
npm start
```

## Environment Configuration

✅ **B-006: Docker Compose local stack** (Complete)
- Full containerized development environment
- PostgreSQL database with initialization
- Redis for job queue processing
- Hot reload for all services
- Comprehensive documentation and scripts

The application will run with basic functionality using the default `.env` file, but you'll need to configure additional services for full feature access.

### Configuration Levels

#### Level 1: Basic UI Testing (Default)
✅ **Works immediately** - Browse UI, test navigation, see components
- No additional setup required
- Database shows as "unavailable" but app functions

#### Level 2: Authentication + Data Persistence
Enables user accounts, workspace/project creation, and data storage
- **Required**: GitHub OAuth + PostgreSQL

#### Level 3: Full Feature Set
Enables AI-powered refinement and external integrations
- **Required**: Level 2 + AI Provider + Linear (optional)

### Required Environment Variables

Copy `.env.example` to `.env` and configure the following:

#### 1. GitHub OAuth (Required for Authentication)

Create a GitHub OAuth application:
1. Go to https://github.com/settings/applications/new
2. **Application name**: `Gastown Tester Local`
3. **Homepage URL**: `http://localhost:4200`
4. **Authorization callback URL**: `http://localhost:3000/auth/github/callback`
5. Copy the generated credentials

```bash
GITHUB_CLIENT_ID=your_actual_client_id
GITHUB_CLIENT_SECRET=your_actual_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/auth/github/callback
```

#### 2. PostgreSQL Database (Required for Data Persistence)

Install and setup PostgreSQL:
```bash
# Install PostgreSQL (macOS)
brew install postgresql
brew services start postgresql

# Create database
createdb gastown_tester
```

Configure database connection:
```bash
DATABASE_URL=postgresql://username:password@localhost:5432/gastown_tester
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gastown_tester
DB_USER=your_username
DB_PASSWORD=your_password
```

#### 3. AI Provider (Optional - for AI-powered refinement)

Choose one AI provider:

**Option A: OpenAI**
```bash
AI_PROVIDER=openai
AI_PROVIDER_API_KEY=sk-your_openai_api_key
AI_PROVIDER_ENDPOINT=https://api.openai.com/v1
AI_PROVIDER_MODEL=gpt-3.5-turbo
```

**Option B: Anthropic Claude**
```bash
AI_PROVIDER=anthropic
AI_PROVIDER_API_KEY=sk-your_anthropic_api_key
AI_PROVIDER_ENDPOINT=https://api.anthropic.com
AI_PROVIDER_MODEL=claude-3-haiku-20240307
```

#### 4. Linear Integration (Optional - for project management)

Get Linear API credentials from https://linear.app/settings/api:
```bash
LINEAR_API_KEY=lin_api_your_linear_api_key
LINEAR_WORKSPACE_ID=your_workspace_id
LINEAR_WEBHOOK_SECRET=your_webhook_secret
```

#### 5. Session Security (Auto-generated for development)

Generate secure secrets:
```bash
# Generate random secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

SESSION_SECRET=your_generated_session_secret
JWT_SECRET=your_generated_jwt_secret
JWT_EXPIRES_IN=1h
```

### What Each Configuration Enables

| Configuration | Enables |
|---------------|---------|
| **GitHub OAuth** | User sign-in, authentication, user profiles |
| **PostgreSQL** | Workspace creation, project management, requirement persistence |
| **AI Provider** | AI-powered requirement refinement, guided questioning, readiness scoring |
| **Linear** | Issue tracking integration, project synchronization |

### Troubleshooting

**Database connection issues:**
- Verify PostgreSQL is running: `brew services list | grep postgresql`
- Check database exists: `psql -l | grep gastown_tester`
- Test connection: `psql postgresql://username:password@localhost:5432/gastown_tester`

**Authentication issues:**
- Verify GitHub OAuth callback URL matches exactly
- Ensure GitHub app is not suspended
- Check browser console for CORS errors

**AI features not working:**
- Verify API key is valid and has sufficient credits
- Check API endpoint is correct for your provider
- Review backend logs for API errors

## Features

### Core Platform
- **User Authentication**: GitHub OAuth integration with session management
- **Workspace Management**: Multi-tenant workspace organization
- **Project Organization**: Project creation with goals, labels, and product areas
- **Requirement Management**: Create, edit, and organize product requirements

### AI-Powered Refinement
- **Guided Questioning**: AI-driven requirement refinement sessions
- **Readiness Scoring**: Automated assessment of requirement completeness
- **Live Summaries**: Real-time requirement summary generation
- **Persona System**: Intelligent workflow orchestration with progression rules

### External Integrations
- **GitHub Integration**: Repository context ingestion and citation management
- **Linear Integration**: Issue tracking and project synchronization
- **Context Sources**: Multi-source context aggregation and freshness tracking

### Technical Features
- **Full-Stack TypeScript**: End-to-end type safety with Angular + Express
- **PostgreSQL Database**: Robust data persistence with migrations
- **Security**: Comprehensive middleware, CORS, CSP headers, input sanitization
- **Observability**: Structured logging, request correlation, health monitoring
- **Job Pipeline**: Background job processing with retry mechanisms

## API Endpoints

### Core
- `GET /` - API information and status
- `GET /health` - Health check with database status

### Authentication
- `GET /auth/github` - GitHub OAuth login
- `GET /auth/github/callback` - OAuth callback handler
- `POST /auth/logout` - User logout
- `GET /auth/user` - Current user information

### Workspaces & Projects
- `GET /api/workspaces` - List user workspaces
- `POST /api/workspaces` - Create workspace
- `GET /api/projects` - List projects in workspace
- `POST /api/projects` - Create project

### Requirements
- `GET /api/requirements` - List requirements for project
- `POST /api/requirements` - Create requirement
- `PUT /api/requirements/:id` - Update requirement
- `DELETE /api/requirements/:id` - Delete requirement

### AI & Refinement
- `POST /api/ai/refine` - Start AI refinement session
- `GET /api/ai/readiness/:id` - Get requirement readiness score
- `POST /api/ai/summarize` - Generate requirement summary

### Integrations
- `GET /api/linear/workspaces` - List Linear workspaces
- `POST /api/linear/connect` - Connect project to Linear
- `GET /api/github-repositories` - List connected repositories
- `POST /api/github-repositories` - Connect repository

### Jobs & Context
- `GET /api/jobs` - List background jobs
- `POST /api/jobs` - Create background job
- `GET /api/context-sources` - List context sources
- `POST /api/context-sources/refresh` - Refresh context data

## Development Workflow

**Docker Compose (Recommended):**
1. **Prerequisites:** Docker 20.10+, Docker Compose 2.0+, Node.js 18+, npm 9+
2. **Setup:** `npm run bootstrap && npm run docker:up`
3. **Documentation:** [docs/DOCKER_COMPOSE.md](./docs/DOCKER_COMPOSE.md)

**Native Development:**
1. **Prerequisites:** Node.js 18+, npm 9+, PostgreSQL 15+, Redis 7+
2. **Setup:** `npm run bootstrap && npm run verify && npm run dev`
3. **Documentation:** [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)

**Manual Development:**
1. Start development servers with `npm run dev`
2. Frontend available at http://localhost:4200
3. Backend API available at http://localhost:3001
4. Frontend will proxy API requests to backend during development
