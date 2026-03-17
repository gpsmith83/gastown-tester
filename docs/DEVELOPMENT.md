# Gastown Tester - Development Guide

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+
- Git

### Bootstrap Process

1. **Clone and bootstrap:**
   ```bash
   git clone <repository-url>
   cd gastown-tester
   npm run bootstrap
   ```

2. **Verify setup:**
   ```bash
   npm run verify
   ```

3. **Start development:**
   ```bash
   npm run dev
   ```

4. **Access applications:**
   - Frontend: http://localhost:3000
   - API: http://localhost:3001
   - API Health: http://localhost:3001/health

## Repository Structure

```
gastown-tester/
├── packages/
│   ├── shared/          # Shared utilities and types
│   ├── api/            # Express.js REST API
│   ├── frontend/       # React frontend (Vite)
│   └── worker/         # Background worker runtime
├── scripts/
│   ├── bootstrap.sh    # Initial setup script
│   └── verify.sh      # Verification script
├── docs/              # Documentation
└── package.json       # Root workspace configuration
```

## Package Overview

### @gastown-tester/shared
- **Purpose:** Common types, utilities, and interfaces
- **Tech:** TypeScript
- **Build:** `npm run build` (outputs to `dist/`)
- **Used by:** All other packages

### @gastown-tester/api
- **Purpose:** REST API server
- **Tech:** Express.js, TypeScript
- **Dev:** `npm run dev` (tsx watch mode)
- **Build:** `npm run build` + `npm start`
- **Port:** 3001

### @gastown-tester/frontend
- **Purpose:** User interface
- **Tech:** React, Vite, TypeScript
- **Dev:** `npm run dev` (Vite dev server)
- **Build:** `npm run build` (static assets)
- **Port:** 3000

### @gastown-tester/worker
- **Purpose:** Background job processing
- **Tech:** Node.js, TypeScript
- **Dev:** `npm run dev` (tsx watch mode)
- **Build:** `npm run build` + `npm start`

## Available Scripts

### Root Level
```bash
npm run bootstrap     # Initial setup (dependencies + env files + source files)
npm run verify       # Test entire setup
npm run dev          # Start all services in development mode
npm run build        # Build all packages
npm run lint         # Lint all packages
npm run test         # Run tests for all packages
npm run db:migrate   # Run database migrations (API)
npm run db:seed      # Seed database (API)
npm run db:reset     # Reset database (API)
```

### Individual Packages
```bash
# In packages/shared, packages/api, packages/frontend, or packages/worker:
npm run dev          # Development mode (watch/hot reload)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Jest tests
npm run clean        # Remove build artifacts
```

## Environment Configuration

### packages/api/.env
```bash
PORT=3001
NODE_ENV=development
DATABASE_URL=          # Configured in B-007
JWT_SECRET=           # Configured in B-007
API_KEY=              # Configured in B-007
```

### packages/frontend/.env
```bash
VITE_API_URL=http://localhost:3001
VITE_APP_NAME=Gastown Tester
```

### packages/worker/.env
```bash
NODE_ENV=development
DATABASE_URL=         # Configured in B-007
REDIS_URL=           # Configured in B-008
```

## Development Workflow

### 1. Feature Development
```bash
git checkout -b feature/my-feature
# Make changes to relevant packages
npm run lint         # Check code style
npm run test         # Run tests
npm run build        # Verify builds
git commit -m "feat: add my feature"
```

### 2. Testing Changes
```bash
npm run verify       # Full verification
npm run dev         # Manual testing
```

### 3. Code Quality
- **Linting:** ESLint with TypeScript rules
- **Testing:** Jest for unit tests
- **Build:** TypeScript compilation
- **Type checking:** Strict TypeScript mode

### 4. Debugging
```bash
# API debugging
cd packages/api && npm run dev    # Watch mode with tsx

# Frontend debugging
cd packages/frontend && npm run dev    # Vite dev server

# Worker debugging
cd packages/worker && npm run dev      # Watch mode with tsx
```

## Project Dependencies

### Shared Dependencies
- **TypeScript:** Type-safe JavaScript
- **ESLint:** Code linting
- **Jest:** Testing framework

### API Dependencies
- **Express.js:** Web framework
- **cors:** Cross-origin requests
- **helmet:** Security headers
- **dotenv:** Environment variables
- **tsx:** TypeScript execution

### Frontend Dependencies
- **React:** UI framework
- **Vite:** Build tool and dev server
- **Vitest:** Testing framework

### Worker Dependencies
- **tsx:** TypeScript execution
- **dotenv:** Environment variables

## Troubleshooting

### Common Issues

1. **"Dependencies not installed"**
   ```bash
   npm run bootstrap
   ```

2. **"Package X dependencies missing"**
   ```bash
   npm ci                    # Reinstall all dependencies
   ```

3. **"TypeScript compilation failed"**
   ```bash
   npm run clean:all         # Clean all build artifacts
   npm run build            # Rebuild everything
   ```

4. **"Port already in use"**
   ```bash
   # Kill processes using ports 3000 or 3001
   lsof -ti:3000 | xargs kill -9
   lsof -ti:3001 | xargs kill -9
   ```

5. **"Environment file missing"**
   ```bash
   npm run bootstrap        # Recreates missing .env files
   ```

### Getting Help

1. Run `npm run verify` to check setup
2. Check logs in each package's terminal output
3. Ensure all prerequisites are installed
4. Review error messages for specific guidance

## Next Steps

This bootstrap establishes the foundation. Follow-up work:

- **B-006:** Docker Compose local stack
- **B-007:** Local secrets and external access prerequisites
- **B-008:** Worker runtime and job execution skeleton

Each subsequent task builds on this foundation to create a complete development environment.