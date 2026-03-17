#!/bin/bash
set -e

echo "🚀 Bootstrapping Gastown Tester development environment..."

# Check Node.js version
required_node_version="18"
current_node_version=$(node -v | cut -d'.' -f1 | sed 's/v//')

if [ "$current_node_version" -lt "$required_node_version" ]; then
    echo "❌ Error: Node.js version $required_node_version or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version check passed: $(node -v)"

# Check npm version
required_npm_version="9"
current_npm_version=$(npm -v | cut -d'.' -f1)

if [ "$current_npm_version" -lt "$required_npm_version" ]; then
    echo "❌ Error: npm version $required_npm_version or higher is required. Current version: $(npm -v)"
    exit 1
fi

echo "✅ npm version check passed: $(npm -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Create environment files if they don't exist
echo "🔧 Setting up environment files..."

if [ ! -f "packages/api/.env" ]; then
    echo "Creating packages/api/.env from template..."
    cat > packages/api/.env << EOF
# API Configuration
PORT=3001
NODE_ENV=development

# Database (placeholder - will be configured in B-007)
DATABASE_URL=

# External services (placeholder - will be configured in B-007)
JWT_SECRET=
API_KEY=
EOF
fi

if [ ! -f "packages/frontend/.env" ]; then
    echo "Creating packages/frontend/.env from template..."
    cat > packages/frontend/.env << EOF
# Frontend Configuration
VITE_API_URL=http://localhost:3001
VITE_APP_NAME=Gastown Tester
EOF
fi

if [ ! -f "packages/worker/.env" ]; then
    echo "Creating packages/worker/.env from template..."
    cat > packages/worker/.env << EOF
# Worker Configuration
NODE_ENV=development

# Database (placeholder - will be configured in B-007)
DATABASE_URL=

# Job queue configuration (placeholder - will be configured in B-008)
REDIS_URL=
EOF
fi

# Create basic source files
echo "📁 Creating initial source files..."

# Shared package
mkdir -p packages/shared/src
if [ ! -f "packages/shared/src/index.ts" ]; then
    cat > packages/shared/src/index.ts << EOF
// Shared utilities and types for Gastown Tester
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export const createApiResponse = <T>(data: T): ApiResponse<T> => ({
  success: true,
  data
});

export const createErrorResponse = (error: string): ApiResponse => ({
  success: false,
  error
});
EOF
fi

# API package
mkdir -p packages/api/src
if [ ! -f "packages/api/src/index.ts" ]; then
    cat > packages/api/src/index.ts << EOF
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createApiResponse } from '@gastown-tester/shared';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json(createApiResponse({ status: 'healthy', timestamp: new Date() }));
});

app.listen(PORT, () => {
  console.log(\`🚀 API server running on http://localhost:\${PORT}\`);
});
EOF
fi

# Frontend package
mkdir -p packages/frontend/src
if [ ! -f "packages/frontend/src/main.tsx" ]; then
    cat > packages/frontend/src/main.tsx << EOF
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF
fi

if [ ! -f "packages/frontend/src/App.tsx" ]; then
    cat > packages/frontend/src/App.tsx << EOF
import React, { useEffect, useState } from 'react';

function App() {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    fetch(\`\${import.meta.env.VITE_API_URL}/health\`)
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(err => console.error('Health check failed:', err));
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>🚀 Gastown Tester</h1>
      <p>Repository bootstrap and developer workflow foundation</p>

      <div style={{ marginTop: '2rem' }}>
        <h2>API Health Check</h2>
        {health ? (
          <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
            {JSON.stringify(health, null, 2)}
          </pre>
        ) : (
          <p>Loading...</p>
        )}
      </div>
    </div>
  );
}

export default App;
EOF
fi

if [ ! -f "packages/frontend/index.html" ]; then
    cat > packages/frontend/index.html << EOF
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gastown Tester</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF
fi

# Worker package
mkdir -p packages/worker/src
if [ ! -f "packages/worker/src/index.ts" ]; then
    cat > packages/worker/src/index.ts << EOF
import dotenv from 'dotenv';

dotenv.config();

console.log('🔧 Worker runtime starting...');

// Placeholder for job processing logic
// Will be implemented in B-008: Establish worker runtime and job execution skeleton

const worker = {
  start() {
    console.log('✅ Worker runtime ready');
    // TODO: Implement job queue processing
  }
};

worker.start();
EOF
fi

# Create Vite config for frontend
if [ ! -f "packages/frontend/vite.config.ts" ]; then
    cat > packages/frontend/vite.config.ts << EOF
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
});
EOF
fi

echo "✅ Bootstrap complete!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run verify' to test the setup"
echo "2. Run 'npm run dev' to start all services"
echo "3. Open http://localhost:3000 to see the frontend"
echo "4. API will be available at http://localhost:3001"
echo ""
echo "See docs/DEVELOPMENT.md for detailed development workflow"