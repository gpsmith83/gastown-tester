FROM node:18-alpine

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY packages/api/package*.json ./packages/api/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci

# Copy source code
COPY packages/api ./packages/api
COPY packages/shared ./packages/shared
COPY tsconfig.json ./

# Build shared package first
RUN cd packages/shared && npm run build

# Build API package
RUN cd packages/api && npm run build

# Expose port
EXPOSE 3001

# Start command (will be overridden in docker-compose for dev mode)
CMD ["npm", "run", "dev:api"]