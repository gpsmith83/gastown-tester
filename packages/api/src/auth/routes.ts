import { Router, Request, Response } from 'express';
import passport from './passport';
import { createApiResponse, createErrorResponse } from '@gastown-tester/shared';

const router = Router();

// Check if GitHub OAuth is configured
const isGitHubConfigured = () => {
  const clientId = process.env.GITHUB_CLIENT_ID || 'your-github-client-id';
  return clientId !== 'your-github-client-id' && clientId !== 'placeholder-client-id';
};

// GitHub OAuth login initiation
router.get('/auth/github', (req: Request, res: Response, next) => {
  if (!isGitHubConfigured()) {
    return res.status(501).json(createErrorResponse(
      'GitHub OAuth not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.'
    ));
  }
  passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
});

// GitHub OAuth callback
router.get('/auth/github/callback', (req: Request, res: Response, next) => {
  if (!isGitHubConfigured()) {
    return res.status(501).json(createErrorResponse('GitHub OAuth not configured'));
  }

  passport.authenticate('github', { failureRedirect: '/auth/error' })(req, res, (err: any) => {
    if (err) return next(err);
    // Successful authentication, redirect to frontend
    // In a real app, this might redirect to a frontend success page
    res.redirect('http://localhost:3000/dashboard'); // Assuming frontend has a dashboard
  });
});

// Get current user
router.get('/auth/user', (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    res.json(createApiResponse(req.user));
  } else {
    res.status(401).json(createErrorResponse('Not authenticated'));
  }
});

// Logout
router.post('/auth/logout', (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      res.status(500).json(createErrorResponse('Logout failed'));
      return;
    }
    res.json(createApiResponse({ message: 'Logged out successfully' }));
  });
});

// Authentication error page
router.get('/auth/error', (req: Request, res: Response) => {
  res.status(401).json(createErrorResponse('Authentication failed'));
});

// Check authentication status
router.get('/auth/status', (req: Request, res: Response) => {
  res.json(createApiResponse({
    isAuthenticated: req.isAuthenticated(),
    user: req.isAuthenticated() ? req.user : null
  }));
});

export default router;