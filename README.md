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

✅ **B-007: Local secrets and external access prerequisites** (Complete)
- Comprehensive local development setup documentation
- Environment template with all required secrets
- Step-by-step credential provisioning guide
- Security best practices for development vs production

🔄 **Next Steps:**
- B-006: Docker Compose local stack
- B-008: Worker runtime and job execution skeleton

## Getting Started

1. **Prerequisites:** Node.js 18+, npm 9+
2. **Bootstrap:** `npm run bootstrap`
3. **Verify:** `npm run verify`
4. **Develop:** `npm run dev`

For detailed setup instructions, see [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md).

## Local Secrets and External Access

This project integrates with external services requiring authentication. For complete local development setup:

- **Environment Setup**: See [LOCAL-DEVELOPMENT.md](./LOCAL-DEVELOPMENT.md) for step-by-step configuration
- **Required Services**: GitHub OAuth, Linear API, AI providers, session security
- **Environment Template**: Use `.env.example` as your starting point

### Quick Setup

```bash
# Copy environment template
cp .env.example .env.local

# See LOCAL-DEVELOPMENT.md for complete setup instructions
```

## Contributing

1. Ensure your local environment is properly configured (see [LOCAL-DEVELOPMENT.md](./LOCAL-DEVELOPMENT.md))
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Follow TypeScript best practices and existing code style
4. Add tests for new functionality
5. Verify all integration tests pass
6. Submit a pull request with clear description

## License

MIT License - see LICENSE file for details.
