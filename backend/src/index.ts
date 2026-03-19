import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import passport from 'passport';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import configuration and routes
import { configureAuthentication } from './config/auth';
import { testDatabaseConnection, initializeDatabase, isDatabaseAvailable } from './config/init-db';
import authRoutes from './routes/auth';
import workspaceRoutes from './routes/workspaces';
import projectRoutes from './routes/projects';
import aiRoutes from './routes/ai';
import requirementRoutes from './routes/requirements';
import ticketCandidateRoutes from './routes/ticket-candidates';
import linearRoutes from './routes/linear';
import githubRepositoryRoutes from './routes/github-repositories';
import jobRoutes from './routes/jobs';
import contextSourceRoutes from './routes/context-sources';
import exportRoutes from './routes/export';
import { globalAIService } from './services/ai-provider';
import { sanitizeResponse } from './middleware/sanitizeResponse';

// Import correlation middleware and structured logging
import { correlationMiddleware } from './middleware/correlation';
import { appLogger, apiLogger } from './utils/logger';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Error handling interface
interface ApiError extends Error {
  status?: number;
}

// Initialize authentication
configureAuthentication();

// Baseline middleware

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Project-Id']
}));

// Security headers middleware (updated for frontend integration)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.github.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Logging middleware
app.use(morgan('combined', {
  skip: (req: Request) => {
    // Skip logging for health checks to reduce noise
    return req.path === '/health';
  }
}));

// Correlation ID middleware (must be before other logging middleware)
app.use(correlationMiddleware);

// JSON parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced request logging middleware with correlation tracking
app.use((req: Request, res: Response, next: NextFunction) => {
  const logger = apiLogger.withRequest(req);
  logger.info(`${req.method} ${req.path}`, {
    operation: 'request_received',
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  next();
});

// Response sanitization middleware (prevents exposure of sensitive data)
app.use(sanitizeResponse);

// Routes

// Health endpoint (enhanced with database status)
app.get('/health', async (req: Request, res: Response) => {
  const dbAvailable = await isDatabaseAvailable();

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    database: dbAvailable ? 'connected' : 'unavailable'
  });
});

// Root endpoint (updated with new API endpoints)
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Gastown Tester API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/auth',
      workspaces: '/api/workspaces',
      projects: '/api/projects',
      ai: '/api/ai',
      requirements: '/api/requirements',
      ticketCandidates: '/api/ticket-candidates',
      linear: '/api/linear',
      githubRepositories: '/api/github-repositories',
      jobs: '/api/jobs',
      context_sources: '/api/context-sources',
      exports: '/api/exports'
    }
  });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/ticket-candidates', ticketCandidateRoutes);
app.use('/api/linear', linearRoutes);
app.use('/api/github-repositories', githubRepositoryRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/context-sources', contextSourceRoutes);
app.use('/api', exportRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `The requested resource ${req.path} was not found`,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware with correlation tracking
app.use((error: ApiError, req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const status = error.status || 500;
  const message = error.message || 'Internal Server Error';

  // Log error with correlation context
  const logger = apiLogger.withRequest(req);
  logger.error(`Request failed: ${message}`, {
    operation: 'request_error',
    status,
    method: req.method,
    path: req.path,
    stack: error.stack,
    errorName: error.name
  });

  // Send error response
  res.status(status).json({
    error: status >= 500 ? 'Internal Server Error' : message,
    timestamp,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Database initialization and server startup
async function startServer() {
  try {
    appLogger.info('Starting Gastown Tester API...', { operation: 'server_startup' });

    const dbAvailable = await isDatabaseAvailable();
    if (dbAvailable) {
      appLogger.info('Database connection established', { operation: 'database_connect' });

      // Initialize database schema
      try {
        await initializeDatabase();
        appLogger.info('Database schema ready', { operation: 'database_schema_init' });
      } catch (error) {
        appLogger.warn('Database schema initialization failed (normal for existing databases)', {
          operation: 'database_schema_init',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      appLogger.warn('Database not available - API will start but database features will not work', {
        operation: 'database_connect'
      });
      appLogger.warn('Make sure PostgreSQL is running and DATABASE_URL is configured');
    }

    // Initialize AI service
    try {
      await globalAIService.initialize();
      appLogger.info('AI provider initialized successfully', { operation: 'ai_provider_init' });
    } catch (error) {
      appLogger.warn('AI provider initialization failed', {
        operation: 'ai_provider_init',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      appLogger.warn('AI endpoints will not work properly. Check AI_PROVIDER_* environment variables.');
    }

    // Start Express server
    const server = app.listen(PORT, () => {
      appLogger.info('Gastown Tester API server started', {
        operation: 'server_start',
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',
        endpoints: {
          health: `http://localhost:${PORT}/health`,
          auth: `http://localhost:${PORT}/auth`,
          workspaces: `http://localhost:${PORT}/api/workspaces`,
          projects: `http://localhost:${PORT}/api/projects`,
          ai: `http://localhost:${PORT}/api/ai`,
          requirements: `http://localhost:${PORT}/api/requirements`,
          ticketCandidates: `http://localhost:${PORT}/api/ticket-candidates`,
          linear: `http://localhost:${PORT}/api/linear`,
          githubRepositories: `http://localhost:${PORT}/api/github-repositories`,
          jobs: `http://localhost:${PORT}/api/jobs`,
          contextSources: `http://localhost:${PORT}/api/context-sources`
        }
      });
    });

    return server;
  } catch (error) {
    appLogger.error('Failed to start server', {
      operation: 'server_startup',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    process.exit(1);
  }
}

// Start the server
const server = startServer();

// Graceful shutdown
let serverInstance: any = null;

server.then((srv) => {
  serverInstance = srv;
}).catch((error) => {
  appLogger.error('Failed to start server', {
    operation: 'server_startup',
    error: error instanceof Error ? error.message : 'Unknown error'
  });
  process.exit(1);
});

process.on('SIGTERM', () => {
  appLogger.info('SIGTERM received, shutting down gracefully', { operation: 'server_shutdown' });
  if (serverInstance) {
    serverInstance.close(() => {
      appLogger.info('Process terminated', { operation: 'server_shutdown' });
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  appLogger.info('SIGINT received, shutting down gracefully', { operation: 'server_shutdown' });
  if (serverInstance) {
    serverInstance.close(() => {
      appLogger.info('Process terminated', { operation: 'server_shutdown' });
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

export default app;