import { Job } from 'pg-boss';
import { JobHandler } from '../lib/queue';

/**
 * Example job handler to demonstrate the job registration pattern.
 *
 * This serves as a template for creating new background jobs.
 * Jobs should follow this pattern:
 * 1. Define the job data interface
 * 2. Implement the job handler function
 * 3. Export a JobHandler configuration object
 */

// Define the data structure this job expects
export interface ExampleJobData {
  message: string;
  timestamp: number;
  userId?: string;
}

/**
 * Example job handler that logs a message and simulates work
 */
async function handleExampleJob(job: Job<ExampleJobData>): Promise<void> {
  const { message, timestamp, userId } = job.data;
  const jobId = job.id;

  console.log(`🔄 Processing example job ${jobId}:`);
  console.log(`   Message: ${message}`);
  console.log(`   Timestamp: ${new Date(timestamp).toISOString()}`);
  console.log(`   User ID: ${userId || 'anonymous'}`);

  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Job completed successfully
  console.log(`✅ Completed example job ${jobId}`);
}

// Export the job handler configuration
export const exampleJobHandler: JobHandler<ExampleJobData> = {
  name: 'example-job',
  handler: handleExampleJob,
  options: {
    concurrency: 2, // Process up to 2 jobs simultaneously
    retryLimit: 3,  // Retry up to 3 times on failure
    retryDelay: 30, // Wait 30 seconds between retries
    expireInHours: 2 // Jobs expire after 2 hours if not processed
  }
};

/**
 * Helper function to send an example job to the queue
 * This can be used for testing or from API endpoints
 */
export async function sendExampleJob(
  queue: any, // Import from '../lib/queue' in actual usage
  data: ExampleJobData,
  options?: { delay?: number; priority?: number }
): Promise<string> {
  return await queue.sendJob('example-job', data, options);
}