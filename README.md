# Gastown Tester

Repository bootstrap and developer workflow foundation for a modern full-stack application.

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

```bash
# Bootstrap the development environment
npm run bootstrap

# Verify setup
npm run verify

# Start all services
npm run dev
```

**Access Points:**
- Frontend: http://localhost:3000
- API: http://localhost:3001
- API Health: http://localhost:3001/health

## Architecture

**Monorepo Structure:**
- `packages/shared` - Common types and utilities
- `packages/api` - Express.js REST API server
- `packages/frontend` - React frontend (Vite)
- `packages/worker` - Background job processing

**Technology Stack:**
- **Language:** TypeScript
- **Package Manager:** npm workspaces
- **API Framework:** Express.js
- **Frontend Framework:** React + Vite
- **Database:** PostgreSQL 15
- **Cache/Queue:** Redis 7
- **Container:** Docker Compose
- **Testing:** Jest + Vitest
- **Linting:** ESLint
- **Build:** TypeScript compiler

## Development

See [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for complete development guide.

**Common Commands:**
```bash
npm run dev          # Start all services
npm run build        # Build all packages
npm run lint         # Lint all packages
npm run test         # Run all tests
npm run verify       # Full verification
```

## Project Status

✅ **B-000: Repository bootstrap and developer workflow** (Complete)
- Monorepo structure established
- Standard scripts for development workflow
- Bootstrap and verification procedures
- Development documentation

✅ **B-006: Docker Compose local stack** (Complete)
- Full containerized development environment
- PostgreSQL database with initialization
- Redis for job queue processing
- Hot reload for all services
- Comprehensive documentation and scripts

🔄 **Next Steps:**
- B-007: Local secrets and external access prerequisites
- B-008: Worker runtime and job execution skeleton

## Getting Started

**Docker Compose (Recommended):**
1. **Prerequisites:** Docker 20.10+, Docker Compose 2.0+, Node.js 18+, npm 9+
2. **Setup:** `npm run bootstrap && npm run docker:up`
3. **Documentation:** [docs/DOCKER_COMPOSE.md](./docs/DOCKER_COMPOSE.md)

**Native Development:**
1. **Prerequisites:** Node.js 18+, npm 9+, PostgreSQL 15+, Redis 7+
2. **Setup:** `npm run bootstrap && npm run verify && npm run dev`
3. **Documentation:** [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)
