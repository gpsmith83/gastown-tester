import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import session from 'express-session';
import { createApiResponse } from '@gastown-tester/shared';
import passport from './auth/passport';
import authRoutes from './auth/routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:3000', // Frontend URL
  credentials: true // Allow cookies for sessions
}));
app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-for-development',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use(authRoutes);

app.get('/health', (req, res) => {
  res.json(createApiResponse({ status: 'healthy', timestamp: new Date() }));
});

// Example protected route
app.get('/api/protected', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(createApiResponse({
      message: 'This is a protected endpoint',
      user: req.user
    }));
  } else {
    res.status(401).json(createApiResponse({ error: 'Authentication required' }));
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 GitHub OAuth: http://localhost:${PORT}/auth/github`);
});
