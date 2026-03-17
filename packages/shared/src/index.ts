// Shared utilities and types for Gastown Tester
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export const createApiResponse = <T>(data: T): ApiResponse<T> => ({
  success: true,
  data
});

export const createErrorResponse = (error: string): ApiResponse => ({
  success: false,
  error
});
