import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { User } from '@gastown-tester/shared';
import { UserService } from './user-service';

const userService = new UserService();

// Passport session serialization
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await userService.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// GitHub OAuth Strategy
const githubClientId = process.env.GITHUB_CLIENT_ID || 'placeholder-client-id';
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET || 'placeholder-client-secret';
const githubCallbackUrl = process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/auth/github/callback';

// Only set up GitHub strategy if we have valid credentials
if (githubClientId !== 'placeholder-client-id' && githubClientId !== 'your-github-client-id') {
  passport.use(new GitHubStrategy({
    clientID: githubClientId,
    clientSecret: githubClientSecret,
    callbackURL: githubCallbackUrl,
  }, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
  try {
    // Check if user exists
    let user = await userService.findByEmail(profile.emails?.[0]?.value);

    if (!user) {
      // Create new user
      user = await userService.create({
        id: profile.id,
        email: profile.emails?.[0]?.value || '',
        name: profile.displayName || profile.username,
        createdAt: new Date()
      });
    } else {
      // Update existing user
      user = await userService.update(user.id, {
        name: profile.displayName || profile.username
      });
    }

    return done(null, user);
  } catch (error) {
    return done(error);
  }
  }));
} else {
  console.warn('⚠️  GitHub OAuth not configured - using placeholder credentials. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env');
}

export default passport;