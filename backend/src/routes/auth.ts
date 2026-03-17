import { Router, Request, Response } from 'express';
import passport from 'passport';

const router = Router();

// Start GitHub OAuth flow
router.get('/github', passport.authenticate('github', {
  scope: ['user:email']
}));

// GitHub OAuth callback
router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req: Request, res: Response) => {
    // Successful authentication, redirect to frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    res.redirect(`${frontendUrl}/workspace`);
  }
);

// Get current user
router.get('/me', (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    res.json({
      user: req.user,
      authenticated: true
    });
  } else {
    res.json({
      user: null,
      authenticated: false
    });
  }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({
        error: 'Logout failed',
        message: 'An error occurred while logging out'
      });
    }

    res.json({
      message: 'Logged out successfully',
      authenticated: false
    });
  });
});

// Login status check
router.get('/status', (req: Request, res: Response) => {
  res.json({
    authenticated: req.isAuthenticated(),
    user: req.user || null
  });
});

export default router;