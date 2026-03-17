import request from 'supertest';
import express from 'express';
import session from 'express-session';
import authRoutes from './routes';

// Mock passport to avoid GitHub OAuth setup in tests
jest.mock('./passport', () => ({
  authenticate: jest.fn(() => (req: any, res: any, next: any) => next()),
  initialize: () => (req: any, res: any, next: any) => next(),
  session: () => (req: any, res: any, next: any) => next(),
}));

describe('Auth Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    }));

    // Mock authentication state
    app.use((req, res, next) => {
      (req as any).isAuthenticated = jest.fn().mockReturnValue(false);
      (req as any).logout = jest.fn((cb) => cb && cb());
      next();
    });

    app.use(authRoutes);
  });

  describe('GET /auth/status', () => {
    it('should return not authenticated by default', async () => {
      const response = await request(app)
        .get('/auth/status')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          isAuthenticated: false,
          user: null
        }
      });
    });

    it('should return authenticated user when logged in', async () => {
      const mockUser = { id: '123', name: 'Test User', email: 'test@example.com' };

      // Create new app instance with authenticated user
      const authenticatedApp = express();
      authenticatedApp.use(express.json());
      authenticatedApp.use(session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
      }));

      authenticatedApp.use((req, res, next) => {
        (req as any).isAuthenticated = jest.fn().mockReturnValue(true);
        (req as any).user = mockUser;
        (req as any).logout = jest.fn((cb) => cb && cb());
        next();
      });

      authenticatedApp.use(authRoutes);

      const response = await request(authenticatedApp)
        .get('/auth/status')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          isAuthenticated: true,
          user: mockUser
        }
      });
    });
  });

  describe('GET /auth/user', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/auth/user')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Not authenticated'
      });
    });

    it('should return user when authenticated', async () => {
      const mockUser = { id: '123', name: 'Test User', email: 'test@example.com' };

      // Create new app instance with authenticated user
      const authenticatedApp = express();
      authenticatedApp.use(express.json());
      authenticatedApp.use((req, res, next) => {
        (req as any).isAuthenticated = jest.fn().mockReturnValue(true);
        (req as any).user = mockUser;
        next();
      });
      authenticatedApp.use(authRoutes);

      const response = await request(authenticatedApp)
        .get('/auth/user')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockUser
      });
    });
  });

  describe('POST /auth/logout', () => {
    it('should successfully logout', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { message: 'Logged out successfully' }
      });
    });

    it('should handle logout error', async () => {
      // Create new app instance with logout error
      const errorApp = express();
      errorApp.use(express.json());
      errorApp.use(session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
      }));

      errorApp.use((req, res, next) => {
        (req as any).isAuthenticated = jest.fn().mockReturnValue(false);
        (req as any).logout = jest.fn((cb) => cb && cb(new Error('Logout failed')));
        next();
      });

      errorApp.use(authRoutes);

      const response = await request(errorApp)
        .post('/auth/logout')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Logout failed'
      });
    });
  });

  describe('GET /auth/github', () => {
    it('should return error when GitHub OAuth not configured', async () => {
      // Test with placeholder credentials (default)
      process.env.GITHUB_CLIENT_ID = 'your-github-client-id';

      const response = await request(app)
        .get('/auth/github')
        .expect(501);

      expect(response.body).toEqual({
        success: false,
        error: 'GitHub OAuth not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.'
      });
    });
  });

  describe('GET /auth/github/callback', () => {
    it('should return error when GitHub OAuth not configured', async () => {
      // Test with placeholder credentials (default)
      process.env.GITHUB_CLIENT_ID = 'your-github-client-id';

      const response = await request(app)
        .get('/auth/github/callback')
        .expect(501);

      expect(response.body).toEqual({
        success: false,
        error: 'GitHub OAuth not configured'
      });
    });
  });

  describe('GET /auth/error', () => {
    it('should return authentication error', async () => {
      const response = await request(app)
        .get('/auth/error')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Authentication failed'
      });
    });
  });
});