import { User as AppUser } from '@gastown-tester/shared';

declare global {
  namespace Express {
    interface User extends AppUser {}
  }
}

export {};