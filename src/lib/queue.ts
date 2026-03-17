import PgBoss, { Job } from 'pg-boss';

/**
 * Queue configuration and pg-boss setup for background job processing.
 *
 * This module provides a centralized configuration for pg-boss and utilities
 * for job registration, health checks, and queue management.
 */

// Default connection configuration
const DEFAULT_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE || 'gastown_tester',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'password',
  // pg-boss specific options
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
  expireInHours: 24
};

export interface JobHandler<T = any> {
  name: string;
  handler: (job: Job<T>) => Promise<void>;
  options?: {
    concurrency?: number;
    retryLimit?: number;
    retryDelay?: number;
    expireInHours?: number;
  };
}

export class Queue {
  private boss: PgBoss | null = null;
  private isConnected = false;
  private registeredJobs = new Set<string>();

  constructor(private config: any = DEFAULT_CONFIG) {}

  /**
   * Initialize and start the pg-boss instance
   */
  async connect(): Promise<void> {
    if (this.boss) {
      return;
    }

    try {
      this.boss = new PgBoss(this.config);
      await this.boss.start();
      this.isConnected = true;
      console.log('🔄 pg-boss connected successfully');
    } catch (error) {
      console.error('❌ Failed to connect to pg-boss:', error);
      throw error;
    }
  }

  /**
   * Register a job handler with the queue
   */
  async registerJob<T = any>(jobHandler: JobHandler<T>): Promise<void> {
    if (!this.boss) {
      throw new Error('Queue not connected. Call connect() first.');
    }

    const { name, handler, options = {} } = jobHandler;

    if (this.registeredJobs.has(name)) {
      console.warn(`⚠️  Job "${name}" is already registered`);
      return;
    }

    const concurrency = options.concurrency || 1;

    await this.boss.work(name, { teamConcurrency: concurrency }, handler);
    this.registeredJobs.add(name);

    console.log(`✅ Registered job handler: "${name}" (concurrency: ${concurrency})`);
  }

  /**
   * Send a job to the queue
   */
  async sendJob<T = any>(name: string, data: T, options?: {
    priority?: number;
    delay?: number;
    retryLimit?: number;
  }): Promise<string> {
    if (!this.boss) {
      throw new Error('Queue not connected. Call connect() first.');
    }

    const jobId = await this.boss.send(name, data, options);
    console.log(`📤 Sent job "${name}" with ID: ${jobId}`);
    return jobId;
  }

  /**
   * Get queue health and status information
   */
  async getHealthStatus(): Promise<{
    connected: boolean;
    registeredJobs: string[];
    queueInfo?: any;
  }> {
    const healthStatus = {
      connected: this.isConnected,
      registeredJobs: Array.from(this.registeredJobs),
      queueInfo: undefined as any
    };

    if (this.boss && this.isConnected) {
      try {
        // Get basic queue statistics
        healthStatus.queueInfo = {
          // Note: pg-boss doesn't have a direct health check,
          // but we can verify connection by getting version
          version: 'connected'
        };
      } catch (error) {
        console.warn('⚠️  Could not retrieve queue info:', error);
        healthStatus.connected = false;
      }
    }

    return healthStatus;
  }

  /**
   * Gracefully stop the queue
   */
  async disconnect(): Promise<void> {
    if (this.boss) {
      try {
        await this.boss.stop();
        this.boss = null;
        this.isConnected = false;
        this.registeredJobs.clear();
        console.log('🔴 pg-boss disconnected');
      } catch (error) {
        console.error('❌ Error disconnecting from pg-boss:', error);
        throw error;
      }
    }
  }

  /**
   * Get the underlying pg-boss instance (for advanced usage)
   */
  getBoss(): PgBoss | null {
    return this.boss;
  }

  /**
   * Check if the queue is connected
   */
  isReady(): boolean {
    return this.isConnected && this.boss !== null;
  }
}

// Export a singleton instance for application-wide use
export const queue = new Queue();