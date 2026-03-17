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
import refinementSessionRoutes from './routes/refinement-sessions';
import requirementMessageRoutes from './routes/requirement-messages';
import { globalAIService } from './services/ai-provider';

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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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

// JSON parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware for debugging
app.use((req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

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
      refinementSessions: '/api/refinement-sessions',
      requirementMessages: '/api/requirement-messages'
    }
  });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/refinement-sessions', refinementSessionRoutes);
app.use('/api/requirement-messages', requirementMessageRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `The requested resource ${req.path} was not found`,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error: ApiError, req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const status = error.status || 500;
  const message = error.message || 'Internal Server Error';

  // Log error details
  console.error(`[${timestamp}] ERROR ${status}: ${message}`);
  console.error(`Request: ${req.method} ${req.path}`);
  console.error(`Stack: ${error.stack}`);

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
    // Test database connection
    console.log('🔧 Starting Gastown Tester API...');

    const dbAvailable = await isDatabaseAvailable();
    if (dbAvailable) {
      console.log('✅ Database connection established');

      // Initialize database schema
      try {
        await initializeDatabase();
        console.log('✅ Database schema ready');
      } catch (error) {
        console.warn('⚠️ Database schema initialization failed (this is normal for existing databases):', error instanceof Error ? error.message : 'Unknown error');
      }
    } else {
      console.warn('⚠️ Database not available - API will start but database features will not work');
      console.warn('⚠️ Make sure PostgreSQL is running and DATABASE_URL is configured');
    }

    // Initialize AI service
    try {
      await globalAIService.initialize();
      console.log('🤖 AI provider initialized successfully');
    } catch (error) {
      console.warn('⚠️ AI provider initialization failed:', error instanceof Error ? error.message : 'Unknown error');
      console.warn('⚠️ AI endpoints will not work properly. Check AI_PROVIDER_* environment variables.');
    }

    // Start Express server
    const server = app.listen(PORT, () => {
      console.log('🚀 Gastown Tester API server running on port', PORT);
      console.log('📱 Health check:', `http://localhost:${PORT}/health`);
      console.log('🔐 Auth endpoints:', `http://localhost:${PORT}/auth`);
      console.log('🏢 Workspaces API:', `http://localhost:${PORT}/api/workspaces`);
      console.log('📁 Projects API:', `http://localhost:${PORT}/api/projects`);
      console.log('🤖 AI Provider API:', `http://localhost:${PORT}/api/ai`);
      console.log('📋 Requirements API:', `http://localhost:${PORT}/api/requirements`);
      console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
      console.log('🎯 Frontend URL:', process.env.FRONTEND_URL || 'http://localhost:4200');
    });

    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
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
  console.error('Failed to start server:', error);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully');
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('✅ Process terminated');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully');
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('✅ Process terminated');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

export default app;