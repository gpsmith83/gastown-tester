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

### Prerequisites
- Node.js >= 18.0.0
- npm

### Installation
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

## Features

### Frontend (Angular)
- **Application Shell**: Navigation and routing framework
- **Routes**: Sign-in, workspace, project, and requirement views
- **Layout System**: Consistent navigation across all views

### Backend (Express API)
- **RESTful API**: Express.js server with security middleware
- **Health Checks**: `/health` endpoint for monitoring
- **Error Handling**: Structured error responses
- **Security**: Helmet middleware with CSP headers

## API Endpoints

- `GET /` - API information
- `GET /health` - Health check endpoint

## Development Workflow

1. Start development servers with `npm run dev`
2. Frontend available at http://localhost:4200
3. Backend API available at http://localhost:3000
4. Frontend will proxy API requests to backend during development
