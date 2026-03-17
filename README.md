# Gastown Tester

Repository bootstrap and developer workflow foundation for a modern full-stack application.

## Quick Start

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

🔄 **Next Steps:**
- B-006: Docker Compose local stack
- B-007: Local secrets and external access prerequisites
- B-008: Worker runtime and job execution skeleton

## Getting Started

1. **Prerequisites:** Node.js 18+, npm 9+
2. **Bootstrap:** `npm run bootstrap`
3. **Verify:** `npm run verify`
4. **Develop:** `npm run dev`

For detailed setup instructions, see [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md).
