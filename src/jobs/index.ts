/**
 * Job Registry
 *
 * This file exports all job handlers for registration with the worker.
 * When adding new jobs:
 * 1. Create a new job file in this directory
 * 2. Export the JobHandler from that file
 * 3. Add it to the allJobHandlers array below
 *
 * The worker will automatically register all jobs in this array.
 */

import { JobHandler } from '../lib/queue';
import { exampleJobHandler } from './example';

// Add all job handlers to this array
export const allJobHandlers: JobHandler[] = [
  exampleJobHandler,
  // Add new job handlers here as they are created
];

// Export individual handlers for direct use if needed
export { exampleJobHandler } from './example';