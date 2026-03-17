import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { UserModel } from '../models/User';
import { User } from '../models/types';

// Configure GitHub OAuth strategy
export function configureAuthentication() {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    callbackURL: process.env.GITHUB_CALLBACK_URL || '/auth/github/callback',
    scope: ['user:email']
  },
  async (accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      // Extract user information from GitHub profile
      const userData = {
        github_id: profile.id.toString(),
        username: profile.username,
        email: profile.emails?.[0]?.value || '',
        avatar_url: profile.photos?.[0]?.value,
        name: profile.displayName || profile.username
      };

      // Create or update user
      const user = await UserModel.upsert(userData);

      return done(null, user);
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      return done(error, null);
    }
  }));

  // Serialize user for session
  passport.serializeUser((user: any, done: any) => {
    done(null, (user as User).id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done: any) => {
    try {
      const user = await UserModel.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
}

// Authentication middleware
export function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }

  res.status(401).json({
    error: 'Authentication required',
    message: 'Please log in to access this resource'
  });
}

// Optional authentication (doesn't fail if not authenticated)
export function optionalAuth(req: any, res: any, next: any) {
  // User will be available in req.user if authenticated, null otherwise
  next();
}