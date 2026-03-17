# Docker Compose Local Development Stack

This guide explains how to run the complete Gastown Tester application stack using Docker Compose. This is the recommended approach for local development as it provides all services (frontend, API, database, worker) in a consistent, reproducible environment.

## Prerequisites

Before starting, ensure you have:

- **Docker** 20.10+ and **Docker Compose** 2.0+
- **Node.js** 18+ and **npm** 9+ (for local development and bootstrap)
- **Git** for version control

### Verify Prerequisites

```bash
# Check Docker
docker --version
docker compose version

# Check Node.js and npm
node --version
npm --version
```

## Quick Start

### 1. Initial Repository Setup

```bash
# Clone the repository
git clone <repository-url>
cd gastown-tester

# Bootstrap the project (installs dependencies and creates initial files)
npm run bootstrap
```

### 2. Start the Docker Stack

```bash
# Start all services in Docker Compose
docker compose up

# Or run in background (detached mode)
docker compose up -d
```

### 3. Access the Application

Once all services are running:

- **Frontend**: http://localhost:3000 (React application)
- **API**: http://localhost:3001 (Express.js REST API)
- **API Health Check**: http://localhost:3001/health
- **Database**: localhost:5432 (PostgreSQL, accessible with database client)
- **Redis**: localhost:6379 (Redis for job queue)

## Service Details

### Architecture Overview

The Docker Compose stack includes:

| Service | Technology | Port | Purpose |
|---------|------------|------|---------|
| `frontend` | React + Vite | 3000 | User interface |
| `api` | Express.js + TypeScript | 3001 | REST API server |
| `worker` | Node.js + TypeScript | - | Background job processor |
| `postgres` | PostgreSQL 15 | 5432 | Primary database |
| `redis` | Redis 7 | 6379 | Job queue and caching |

### Service Dependencies

```
frontend → api → postgres
worker → postgres + redis
```

Services start in dependency order with health checks ensuring databases are ready.

### Database Schema

The PostgreSQL container automatically initializes with:

- `users` table (id, email, name, created_at)
- `jobs` table (id, type, payload, status, created_at, updated_at)
- Sample data for testing

See `scripts/init-db.sql` for the complete schema.

## Development Workflow

### Starting Development

```bash
# Start all services
docker compose up

# Or start specific services
docker compose up postgres redis api
```

### Making Code Changes

The Docker setup includes volume mounting for hot reloading:

- **API**: Changes to `packages/api/src/` trigger automatic reload
- **Frontend**: Changes to `packages/frontend/src/` trigger Vite hot reload
- **Worker**: Changes to `packages/worker/src/` trigger automatic reload
- **Shared**: Changes to `packages/shared/` require rebuild (`docker compose restart`)

### Database Operations

```bash
# Run database migrations (when available)
docker compose exec api npm run db:migrate

# Seed database with test data (when available)
docker compose exec api npm run db:seed

# Reset database (when available)
docker compose exec api npm run db:reset

# Access database directly
docker compose exec postgres psql -U developer -d gastown_tester
```

### Viewing Logs

```bash
# View logs for all services
docker compose logs

# View logs for specific service
docker compose logs api
docker compose logs frontend
docker compose logs worker

# Follow logs in real-time
docker compose logs -f api
```

## Useful Commands

### Container Management

```bash
# Start services in background
docker compose up -d

# Stop all services
docker compose down

# Stop and remove volumes (deletes database data)
docker compose down -v

# Restart specific service
docker compose restart api

# Rebuild and restart service (after dependency changes)
docker compose up --build api
```

### Service Access

```bash
# Execute commands inside containers
docker compose exec api sh          # Access API container shell
docker compose exec postgres sh     # Access PostgreSQL container
docker compose exec worker npm test # Run worker tests

# View service status
docker compose ps

# View resource usage
docker compose top
```

### Environment Management

The Docker Compose setup uses environment files:

- `packages/api/.env.docker` - API configuration
- `packages/frontend/.env.docker` - Frontend configuration
- `packages/worker/.env.docker` - Worker configuration

These are automatically used when running services in containers.

## Troubleshooting

### Common Issues

#### Port Conflicts

```bash
# Error: Port already in use
# Solution: Stop local services or change ports in docker-compose.yml

# Find processes using ports
lsof -ti:3000 | xargs kill -9  # Frontend port
lsof -ti:3001 | xargs kill -9  # API port
lsof -ti:5432 | xargs kill -9  # PostgreSQL port
```

#### Database Connection Issues

```bash
# Wait for PostgreSQL to be ready
docker compose logs postgres

# Check if database is accepting connections
docker compose exec postgres pg_isready -U developer

# Restart database with fresh data
docker compose down postgres
docker volume rm gastown-tester_postgres_data
docker compose up postgres
```

#### Build Issues

```bash
# Rebuild all containers from scratch
docker compose down
docker compose build --no-cache
docker compose up

# Clear Docker build cache
docker system prune -f
```

#### Volume Mount Issues

```bash
# On Windows/macOS: Ensure Docker Desktop file sharing is enabled
# Check that the repository directory is accessible to Docker

# Restart Docker Desktop and try again
docker compose down
docker compose up
```

### Service Health Checks

All services include health checks:

```bash
# Check service health
docker compose ps

# Services should show "healthy" status when ready
# If services are "starting" for too long, check logs
docker compose logs <service-name>
```

## Alternative: Native Development

If you prefer to run services natively (without Docker):

1. Follow the main [DEVELOPMENT.md](./DEVELOPMENT.md) guide
2. Install and configure PostgreSQL and Redis locally
3. Update environment files to use localhost connections
4. Run `npm run dev` for local development

## Next Steps

With the Docker Compose stack running:

1. **Verify Setup**: Visit http://localhost:3000 to see the frontend
2. **Check API**: Visit http://localhost:3001/health for API status
3. **Database**: Connect with your preferred PostgreSQL client to localhost:5432
4. **Development**: Start making changes to the source code

The development environment is now ready for feature development, testing, and debugging.