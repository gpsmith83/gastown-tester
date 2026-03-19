/**
 * Background Worker Process
 *
 * This is the main entry point for the background job worker.
 * It connects to pg-boss, registers all job handlers, and provides
 * health monitoring capabilities.
 *
 * Usage:
 *   npm run worker        # Start worker in production
 *   npm run worker:dev    # Start worker in development mode
 */

import { queue } from './lib/queue';
import { allJobHandlers } from './jobs';

/**
 * Worker health status interface
 */
interface WorkerHealth {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  queue: {
    connected: boolean;
    registeredJobs: string[];
  };
  environment: {
    nodeEnv: string;
    processId: number;
  };
}

class Worker {
  private startTime: number = Date.now();
  private isShuttingDown = false;

  /**
   * Start the worker process
   */
  async start(): Promise<void> {
    console.log('🚀 Starting Gastown Tester background worker...');
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🆔 Process ID: ${process.pid}`);

    try {
      // Connect to pg-boss
      await queue.connect();
      console.log('✅ Queue connection established');

      // Register all job handlers
      console.log(`📝 Registering ${allJobHandlers.length} job handlers...`);
      for (const jobHandler of allJobHandlers) {
        await queue.registerJob(jobHandler);
      }

      console.log('🎯 All job handlers registered successfully');
      console.log('🔄 Worker is ready to process jobs');

      // Set up graceful shutdown handlers
      this.setupGracefulShutdown();

      // Log worker health status every 60 seconds
      this.startHealthLogging();

    } catch (error) {
      console.error('❌ Failed to start worker:', error);
      process.exit(1);
    }
  }

  /**
   * Get current worker health status
   */
  async getHealth(): Promise<WorkerHealth> {
    const queueHealth = await queue.getHealthStatus();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      status: queueHealth.connected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime,
      queue: {
        connected: queueHealth.connected,
        registeredJobs: queueHealth.registeredJobs
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        processId: process.pid
      }
    };
  }

  /**
   * Log health status periodically
   */
  private startHealthLogging(): void {
    const interval = setInterval(async () => {
      if (this.isShuttingDown) {
        clearInterval(interval);
        return;
      }

      try {
        const health = await this.getHealth();
        console.log(`💓 Worker Health: ${health.status} | Uptime: ${health.uptime}s | Jobs: ${health.queue.registeredJobs.length}`);
      } catch (error) {
        console.error('⚠️  Health check failed:', error);
      }
    }, 60000); // Every 60 seconds
  }

  /**
   * Set up graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        console.log('🔄 Shutdown already in progress...');
        return;
      }

      this.isShuttingDown = true;
      console.log(`📴 ${signal} received, shutting down worker gracefully...`);

      try {
        // Disconnect from the queue (this will complete ongoing jobs)
        await queue.disconnect();
        console.log('✅ Worker shutdown completed successfully');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during worker shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }
}

// CLI check - only start worker if this file is run directly
if (require.main === module) {
  const worker = new Worker();
  worker.start().catch((error) => {
    console.error('💥 Worker startup failed:', error);
    process.exit(1);
  });
}

export { Worker };
export default Worker;