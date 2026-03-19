import express, { Request, Response } from 'express';
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
import userRoutes from './routes/users';
import workspaceRoutes from './routes/workspaces';
import projectRoutes from './routes/projects';
import requirementRoutes from './routes/requirements';
import aiRoutes from './routes/ai';
import refinementRoutes from './routes/refinements';
import ticketCandidateRoutes from './routes/ticket-candidates';
import ticketRoutes from './routes/tickets';
import linearRoutes from './routes/linear';
import githubRepositoryRoutes from './routes/github-repositories';
import jobRoutes from './routes/jobs';
import contextSourceRoutes from './routes/context-sources';
import monitoringRoutes from './routes/monitoring';
import { globalAIService } from './services/ai-provider';
import { performanceMonitoringMiddleware } from './middleware/performanceMonitoring';

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting
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
  credentials: true
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

// JSON parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  apiLogger.info('Request received', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  next();
});

// Response sanitization
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
      ai: '/api/ai',
      requirements: '/api/requirements',
      tickets: '/api/tickets',
      linear: '/api/linear',
      githubRepositories: '/api/github-repositories',
      jobs: '/api/jobs',
      context_sources: '/api/context-sources',
      monitoring: '/api/monitoring'
    }
  });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/refinements', refinementRoutes);
app.use('/api/ticket-candidates', ticketCandidateRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/linear', linearRoutes);
app.use('/api/github-repositories', githubRepositoryRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/context-sources', contextSourceRoutes);
app.use('/api/monitoring', monitoringRoutes);

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
          linear: `http://localhost:${PORT}/api/linear`,
          githubRepositories: `http://localhost:${PORT}/api/github-repositories`,
          jobs: `http://localhost:${PORT}/api/jobs`,
          contextSources: `http://localhost:${PORT}/api/context-sources`,
          personaProgression: `http://localhost:${PORT}/api/persona-progression`
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

export default app;
