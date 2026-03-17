FROM node:18-alpine

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY packages/worker/package*.json ./packages/worker/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci

# Copy source code
COPY packages/worker ./packages/worker
COPY packages/shared ./packages/shared
COPY tsconfig.json ./

# Build shared package first
RUN cd packages/shared && npm run build

# Build worker package
RUN cd packages/worker && npm run build

# Start command (will be overridden in docker-compose for dev mode)
CMD ["npm", "run", "dev:worker"]