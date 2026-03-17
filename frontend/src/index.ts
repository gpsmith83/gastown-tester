import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { testConnection, closeConnection } from './database/connection';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Error handling interface
interface ApiError extends Error {
  status?: number;
}

// Baseline middleware

// Security headers middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

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

// Health endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Test database connection
    const dbHealthy = await testConnection();

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      database: dbHealthy ? 'connected' : 'disconnected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      database: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Database health check endpoint
app.get('/health/db', async (req: Request, res: Response) => {
  try {
    const dbHealthy = await testConnection();
    res.status(dbHealthy ? 200 : 503).json({
      status: dbHealthy ? 'healthy' : 'unhealthy',
      database: dbHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Gastown Tester API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      docs: '/api-docs'
    }
  });
});

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

// Initialize database and start server
const startServer = async () => {
  try {
    // Test database connection on startup
    console.log('🔗 Testing database connection...');
    const dbHealthy = await testConnection();
    if (!dbHealthy) {
      console.warn('⚠️  Database connection test failed, but server will start anyway');
    }

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Gastown Tester API server running on port ${PORT}`);
      console.log(`📱 Health check: http://localhost:${PORT}/health`);
      console.log(`🗄️  Database health: http://localhost:${PORT}/health/db`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    return server;
  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer().then((server) => {

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`📴 ${signal} received, shutting down gracefully`);

    try {
      // Close HTTP server
      await new Promise<void>((resolve) => {
        server.close(() => {
          console.log('🌐 HTTP server closed');
          resolve();
        });
      });

      // Close database connections
      await closeConnection();

      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}).catch((error) => {
  console.error('💥 Server startup failed:', error);
  process.exit(1);
});

export default app;