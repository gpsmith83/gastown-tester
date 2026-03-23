import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import passport from 'passport';
import morgan from 'morgan';
import { correlationMiddleware } from './middleware/correlation';
import { appLogger, apiLogger } from './utils/logger';
import { sanitizeResponse } from './middleware/sanitizeResponse';
import authRoutes from './routes/auth';
import { isDatabaseAvailable, initializeDatabase } from './config/database';

// Import route modules
import workspaceRoutes from './routes/workspaces';
import projectRoutes from './routes/projects';
// import aiRoutes from './routes/ai'; // Temporarily disabled due to syntax errors
// import aiAuditRoutes from './routes/ai-audit'; // Temporarily disabled
// import requirementRoutes from './routes/requirements'; // Temporarily disabled due to TypeScript errors
// import refinementSessionRoutes from './routes/refinement-sessions'; // Temporarily disabled
// import requirementMessageRoutes from './routes/requirement-messages'; // Temporarily disabled
// import ticketCandidateRoutes from './routes/ticket-candidates'; // Temporarily disabled
// import ticketRoutes from './routes/tickets'; // Temporarily disabled
// import linearRoutes from './routes/linear'; // Temporarily disabled
// import githubRepositoryRoutes from './routes/github-repositories'; // Temporarily disabled
import jobRoutes from './routes/jobs';
// import contextSourceRoutes from './routes/context-sources'; // Temporarily disabled
import monitoringRoutes from './routes/monitoring';
// import personaProgressionRoutes from './routes/personaProgression'; // Temporarily disabled
// import { exportsRouter } from './routes/exports'; // Temporarily disabled
// import personaOrchestrationRoutes from './routes/persona-orchestration'; // Temporarily disabled
// import personaRecommendationRoutes from './routes/persona-recommendations'; // Temporarily disabled
import { globalAIService } from './services/ai-provider';
import { performanceMonitoringMiddleware } from './middleware/performanceMonitoring';
// import { globalRetryProcessor } from './services/RetryProcessor'; // Temporarily disabled

// Import security middleware
import {
  generalRateLimit,
  authRateLimit,
  sanitizeInput,
  requestSizeLimit,
  securityLogging,
  validateTenantIsolation
} from './middleware/security';

const app = express();
const PORT = process.env.PORT || 3001;

// Enhanced security logging
app.use(securityLogging);

// Rate limiting with enhanced controls
app.use(generalRateLimit);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs
});

app.use(limiter);

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:4200', 'http://localhost:3000'],
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

// Performance monitoring middleware (must be after correlation middleware)
app.use(performanceMonitoringMiddleware);

// JSON parsing middleware with enhanced security
app.use(requestSizeLimit(1024 * 1024 * 10)); // 10MB limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization and validation
app.use(sanitizeInput);
app.use(validateTenantIsolation);

// Enhanced request logging middleware with correlation tracking
app.use((req: Request, res: Response, next: NextFunction) => {
  const logger = apiLogger.withRequest(req);
  logger.info(`${req.method} ${req.path}`, {
    operation: 'request_received',
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  next();
});

// Response sanitization middleware (prevents exposure of sensitive data)
app.use(sanitizeResponse);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
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
      jobs: '/api/jobs',
      monitoring: '/api/monitoring'
    }
  });
});

// API Routes with enhanced rate limiting for auth endpoints
app.use('/auth', authRateLimit, authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/projects', projectRoutes);
// app.use('/api/ai', aiRoutes); // Temporarily disabled
// app.use('/api/ai/audit', aiAuditRoutes); // Temporarily disabled
// app.use('/api/requirements', requirementRoutes); // Temporarily disabled
// app.use('/api/refinement-sessions', refinementSessionRoutes); // Temporarily disabled
// app.use('/api/requirement-messages', requirementMessageRoutes); // Temporarily disabled
// app.use('/api/ticket-candidates', ticketCandidateRoutes); // Temporarily disabled
// app.use('/api/tickets', ticketRoutes); // Temporarily disabled
// app.use('/api/linear', linearRoutes); // Temporarily disabled
// app.use('/api/github-repositories', githubRepositoryRoutes); // Temporarily disabled
app.use('/api/jobs', jobRoutes);
// app.use('/api/context-sources', contextSourceRoutes); // Temporarily disabled
app.use('/api/monitoring', monitoringRoutes);
// app.use('/api/persona-progression', personaProgressionRoutes); // Temporarily disabled
// app.use('/api/exports', exportsRouter); // Temporarily disabled
// app.use('/api/persona-orchestration', personaOrchestrationRoutes); // Temporarily disabled
// app.use('/api/persona-recommendations', personaRecommendationRoutes); // Temporarily disabled

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `The requested resource ${req.path} was not found`,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error: any, req: Request, res: Response, next: any) => {
  appLogger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production'
      ? 'Something went wrong'
      : error.message,
    timestamp: new Date().toISOString()
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

    // Initialize export retry processor if database is available
    // Temporarily disabled due to dependency issues
    // if (dbAvailable) {
    //   try {
    //     globalRetryProcessor.start(60000); // Check every minute
    //     appLogger.info('Export retry processor started', { operation: 'retry_processor_init' });
    //   } catch (error) {
    //     appLogger.warn('Export retry processor initialization failed', {
    //       operation: 'retry_processor_init',
    //       error: error instanceof Error ? error.message : 'Unknown error'
    //     });
    //   }
    // }

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
          'ai-audit': `http://localhost:${PORT}/api/ai/audit`,
          requirements: `http://localhost:${PORT}/api/requirements`,
          linear: `http://localhost:${PORT}/api/linear`,
          githubRepositories: `http://localhost:${PORT}/api/github-repositories`,
          jobs: `http://localhost:${PORT}/api/jobs`,
          contextSources: `http://localhost:${PORT}/api/context-sources`,
          personaProgression: `http://localhost:${PORT}/api/persona-progression`,
          exports: `http://localhost:${PORT}/api/exports`,
          personaOrchestration: `http://localhost:${PORT}/api/persona-orchestration`
        }
      });

      // Also log to console for development visibility
      console.log('🚀 Gastown Tester API server running on port', PORT);
      console.log('📊 AI Audit API:', `http://localhost:${PORT}/api/ai/audit`);
      console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
      console.log('🔐 Enhanced security middleware active');
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
  // globalRetryProcessor.stop(); // Temporarily disabled
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
  // globalRetryProcessor.stop(); // Temporarily disabled
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