// Vitest setup for React testing
import { beforeAll, afterEach, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';

// Setup global test environment
beforeAll(() => {
  // Global setup if needed
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Cleanup after all tests
afterAll(() => {
  // Global cleanup if needed
});