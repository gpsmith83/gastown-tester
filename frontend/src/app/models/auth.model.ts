import { User } from './workspace.model';

export interface AuthStatus {
  authenticated: boolean;
  user: User | null;
}

export interface LoginResponse {
  user: User;
  authenticated: boolean;
}

export interface LogoutResponse {
  message: string;
  authenticated: boolean;
}