import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { correlationMiddleware } from './middleware/correlation';
import { appLogger, apiLogger } from './utils/logger';
import { sanitizeResponse } from './middleware/sanitizeResponse';

// Import route modules
import userRoutes from './routes/users';
import workspaceRoutes from './routes/workspaces';
import projectRoutes from './routes/projects';
import requirementRoutes from './routes/requirements';
import aiRoutes from './routes/ai';
import refinementRoutes from './routes/refinements';
import ticketCandidateRoutes from './routes/ticket-candidates';
import linearRoutes from './routes/linear';
import githubRepositoryRoutes from './routes/github-repositories';
import jobRoutes from './routes/jobs';
import contextSourceRoutes from './routes/context-sources';
import exportRoutes from './routes/export';           // Linear export system
import exportTrackingRoutes from './routes/exports';  // Export tracking system
import { globalAIService } from './services/ai-provider';

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

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Correlation middleware (should be early in the stack)
app.use(correlationMiddleware);

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

// Mount route modules
app.use('/api/users', userRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/refinements', refinementRoutes);
app.use('/api/ticket-candidates', ticketCandidateRoutes);
app.use('/api/linear', linearRoutes);
app.use('/api/github-repositories', githubRepositoryRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/context-sources', contextSourceRoutes);
app.use('/api', exportRoutes);                    // Linear export system at /api/exports/*
app.use('/api/export-tracking', exportTrackingRoutes);  // Export tracking at /api/export-tracking/*

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

// Initialize AI service
globalAIService.initialize().catch(error => {
  appLogger.error('Failed to initialize AI service', { error: error.message });
});

app.listen(PORT, () => {
  appLogger.info(`Server running on port ${PORT}`);
});

export default app;
