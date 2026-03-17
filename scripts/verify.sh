#!/bin/bash
set -e

echo "🔍 Verifying Gastown Tester setup..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ Dependencies not installed. Run 'npm run bootstrap' first."
    exit 1
fi

echo "✅ Dependencies installed"

# Check if all packages have their dependencies
for package in shared api frontend worker; do
    if [ ! -d "packages/$package/node_modules" ]; then
        echo "❌ Package $package dependencies missing"
        exit 1
    fi
done

echo "✅ All package dependencies present"

# Check TypeScript compilation
echo "🔍 Checking TypeScript compilation..."

cd packages/shared && npm run build
cd ../api && npm run build
cd ../worker && npm run build
cd ../..

echo "✅ TypeScript compilation successful"

# Check linting
echo "🔍 Running linters..."
npm run lint

echo "✅ Linting passed"

# Check that environment files exist
for env_file in packages/api/.env packages/frontend/.env packages/worker/.env; do
    if [ ! -f "$env_file" ]; then
        echo "❌ Missing environment file: $env_file"
        exit 1
    fi
done

echo "✅ Environment files present"

# Test API startup (quick check)
echo "🔍 Testing API startup..."
cd packages/api
timeout 10s npm start > /dev/null 2>&1 &
api_pid=$!
sleep 3

# Check if API is responding
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ API responds to health check"
else
    echo "⚠️  API health check failed (may need database setup - see B-007)"
fi

# Clean up
kill $api_pid 2>/dev/null || true
cd ../..

echo ""
echo "🎉 Verification complete!"
echo ""
echo "Ready for development:"
echo "• Run 'npm run dev' to start all services"
echo "• Frontend: http://localhost:3000"
echo "• API: http://localhost:3001"
echo "• Worker: background process"
echo ""
echo "Next steps:"
echo "• B-006: Docker Compose local stack"
echo "• B-007: Local secrets and external access"
echo "• B-008: Worker runtime and job execution"