# Local Development Setup Guide

This guide provides step-by-step instructions for setting up your local development environment for the Gastown Tester project.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Git
- A code editor (VS Code recommended)
- Access to GitHub, Linear, and your chosen AI provider

## Step-by-Step Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd gastown-tester

# Install dependencies
npm install

# Verify installation
npm run type-check
```

### 2. Environment Configuration

#### Create Local Environment File

```bash
# Copy the template
cp .env.example .env.local

# Open in your editor
code .env.local  # or vim .env.local
```

#### Generate Secure Secrets

Run these commands to generate cryptographically secure secrets:

```bash
# Generate session secret
echo "SESSION_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"

# Generate JWT secret
echo "JWT_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"

# Generate Linear webhook secret
echo "LINEAR_WEBHOOK_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
```

Copy the generated values into your `.env.local` file.

### 3. External Service Setup

#### 3.1 GitHub OAuth Application

1. **Navigate to GitHub Settings**
   - Go to https://github.com/settings/applications/new
   - Or: GitHub Settings → Developer settings → OAuth Apps → New OAuth App

2. **Create Development Application**
   ```
   Application name: Gastown Tester (Dev - [Your Name])
   Homepage URL: http://localhost:3000
   Application description: Local development for Gastown Tester
   Authorization callback URL: http://localhost:3000/auth/github/callback
   ```

3. **Configure Scopes and Permissions**
   - The application will request `user:email` and `read:user` scopes
   - For repository access (if needed): add `repo` scope
   - **Important**: Use only development repositories during testing

4. **Copy Credentials**
   - Copy the Client ID to `GITHUB_CLIENT_ID` in `.env.local`
   - Generate and copy Client Secret to `GITHUB_CLIENT_SECRET`

#### 3.2 Linear API Access

1. **Create/Access Development Workspace**
   - Option A: Create new workspace: "Gastown Tester Dev"
   - Option B: Request access to existing dev workspace from team lead

2. **Generate API Key**
   - Go to https://linear.app/settings/api
   - Click "Create new key"
   - Name: `Gastown Tester Local Dev - [Your Name]`
   - Scopes: `read`, `write` (limited to development workspace)
   - Copy the key to `LINEAR_API_KEY` in `.env.local`

3. **Get Workspace ID**
   ```bash
   # Test your API key and get workspace ID
   curl -X POST https://api.linear.app/graphql \
     -H "Authorization: YOUR_LINEAR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"query": "{ viewer { organization { id name } } }"}'
   ```
   - Copy the organization ID to `LINEAR_WORKSPACE_ID`

#### 3.3 AI Provider Setup

Choose one of the following options:

**Option A: OpenAI (Recommended for Development)**

1. Sign up at https://platform.openai.com/
2. Create API key with usage limits
3. Configure in `.env.local`:
   ```bash
   AI_PROVIDER=openai
   AI_PROVIDER_API_KEY=your_openai_api_key
   AI_PROVIDER_ENDPOINT=https://api.openai.com/v1
   AI_PROVIDER_MODEL=gpt-3.5-turbo
   ```

**Option B: Anthropic Claude**

1. Sign up at https://console.anthropic.com/
2. Create API key
3. Configure in `.env.local`:
   ```bash
   AI_PROVIDER=anthropic
   AI_PROVIDER_API_KEY=your_anthropic_api_key
   AI_PROVIDER_ENDPOINT=https://api.anthropic.com
   AI_PROVIDER_MODEL=claude-3-haiku-20240307
   ```

**Option C: Local AI (Cost-free)**

1. Install Ollama: https://ollama.ai/
2. Pull a model: `ollama pull llama2`
3. Configure in `.env.local`:
   ```bash
   AI_PROVIDER=local
   AI_PROVIDER_API_KEY=not_required
   AI_PROVIDER_ENDPOINT=http://localhost:11434
   AI_PROVIDER_MODEL=llama2
   ```

### 4. Verification and Testing

#### 4.1 Environment Verification

Create a verification script to test your setup:

```bash
# Create verification script
cat > verify-setup.js << 'EOF'
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Local Development Setup...\n');

// Check if .env.local exists
const envPath = '.env.local';
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local file not found');
  process.exit(1);
}

// Load environment
require('dotenv').config({ path: envPath });

const requiredVars = [
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'SESSION_SECRET',
  'JWT_SECRET',
  'LINEAR_API_KEY',
  'LINEAR_WEBHOOK_SECRET',
  'AI_PROVIDER_API_KEY'
];

let allGood = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (!value || value.startsWith('your_')) {
    console.error(`❌ ${varName} not configured or contains placeholder value`);
    allGood = false;
  } else {
    console.log(`✅ ${varName} configured`);
  }
});

if (allGood) {
  console.log('\n🎉 All required environment variables are configured!');
  console.log('\n📋 Next steps:');
  console.log('1. Run: npm run dev');
  console.log('2. Test: curl http://localhost:3000/health');
  console.log('3. Start developing auth and integration features');
} else {
  console.log('\n❌ Please fix the configuration issues above');
  process.exit(1);
}
EOF

# Run verification
npm install dotenv --save-dev
node verify-setup.js
```

#### 4.2 Application Testing

```bash
# Start development server
npm run dev

# Test health endpoint (in another terminal)
curl http://localhost:3000/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2024-...",
#   "uptime": 0.123,
#   "version": "1.0.0"
# }
```

#### 4.3 Integration Testing (When Implemented)

Test external service connectivity:

```bash
# Test GitHub OAuth flow (when auth routes are implemented)
curl -I http://localhost:3000/auth/github

# Test Linear webhook endpoint (when implemented)
curl -X POST http://localhost:3000/webhooks/linear \
  -H "Content-Type: application/json" \
  -H "X-Linear-Signature: test" \
  -d '{"test": true}'

# Test AI provider endpoint (when implemented)
curl -X POST http://localhost:3000/api/ai/test \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, world!"}'
```

## Development Workflow

### Daily Development

1. **Start Development Session**
   ```bash
   # Pull latest changes
   git pull origin main

   # Install any new dependencies
   npm install

   # Start development server
   npm run dev
   ```

2. **Pre-commit Checklist**
   ```bash
   # Type check
   npm run type-check

   # Run tests
   npm test

   # Verify no secrets in code
   git diff --cached | grep -E "(api_key|secret|password|token)" || echo "No secrets detected"
   ```

### Environment Management

- **Development**: Use `.env.local` with development credentials
- **Testing**: Create `.env.test` for automated testing (if needed)
- **Never**: Commit any `.env.*` files except `.env.example`

### Secret Rotation

Rotate your development secrets regularly:

```bash
# Generate new secrets
node -e 'console.log("New secrets:");
["SESSION_SECRET", "JWT_SECRET", "LINEAR_WEBHOOK_SECRET"].forEach(name =>
  console.log(`${name}=${require("crypto").randomBytes(32).toString("hex")}`)
)'

# Update external services (GitHub OAuth, Linear API) as needed
```

## Troubleshooting

### Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` | Service not running | Check if external services are accessible |
| `Invalid client_id` | GitHub OAuth misconfigured | Verify callback URL matches exactly |
| `401 Unauthorized` | Invalid API keys | Check key format and permissions |
| `Cannot read property 'split'` | Environment variable format | Check for extra quotes or spaces |

### Debug Mode

Enable detailed logging:

```bash
LOG_LEVEL=debug npm run dev
```

### Resetting Setup

If you need to start over:

```bash
# Remove environment file
rm .env.local

# Clean node modules (if needed)
rm -rf node_modules package-lock.json
npm install

# Start from Step 2 above
```

## Security Best Practices

### Development Security

- ✅ Use separate development credentials from production
- ✅ Limit API key permissions to minimum required scope
- ✅ Use development workspaces/organizations only
- ✅ Rotate secrets regularly
- ✅ Never commit credentials to version control

### Code Security

- ✅ Use environment variables for all secrets
- ✅ Validate all external inputs
- ✅ Use HTTPS for all external API calls
- ✅ Implement proper error handling that doesn't leak secrets
- ✅ Use secure session management

## Getting Help

- **Documentation Issues**: Check README.md for additional context
- **Environment Setup**: Re-run the verification script
- **External Service Issues**: Check service status pages
- **Code Issues**: Review TypeScript errors with `npm run type-check`

Happy coding! 🚀