import dotenv from 'dotenv';
import { JobQueue } from './job-queue';
import { ContextIngestionJob } from './jobs/context-ingestion-job';

// Load environment variables
dotenv.config();

console.log('🔧 Worker runtime starting...');

/**
 * Main worker runtime for Gastown Tester
 * Implements B-008: Establish worker runtime and job execution skeleton
 * Extended for B-604: Repository context ingestion job pipeline
 */
class WorkerRuntime {
  private jobQueue: JobQueue;

  constructor() {
    this.jobQueue = new JobQueue();
  }

  async start() {
    console.log('🔧 Initializing worker runtime...');

    // Register job handlers
    this.jobQueue.registerHandler('context-ingestion', ContextIngestionJob);

    // Start the job queue processor
    await this.jobQueue.start();

    console.log('✅ Worker runtime ready');
    console.log('📋 Registered job types: context-ingestion');
    console.log('🔄 Job queue processing started');
  }

  async shutdown() {
    console.log('📴 Shutting down worker runtime...');
    await this.jobQueue.shutdown();
    console.log('✅ Worker runtime stopped');
  }
}

// Start the worker
const worker = new WorkerRuntime();

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  await worker.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await worker.shutdown();
  process.exit(0);
});

// Start the worker
worker.start().catch((error) => {
  console.error('❌ Failed to start worker runtime:', error);
  process.exit(1);
});

export default worker;
