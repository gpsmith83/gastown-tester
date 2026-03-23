import { db } from '../config/database';
import { ExportService } from './ExportService';
import { appLogger } from '../utils/logger';

/**
 * Background retry processor for export batches (B-506)
 * Processes failed exports with retry logic
 */
export class RetryProcessor {
  private exportService: ExportService;
  private intervalId?: NodeJS.Timeout;
  private isProcessing = false;

  constructor() {
    this.exportService = new ExportService(db);
  }

  /**
   * Start the retry processor with periodic execution
   */
  start(intervalMs: number = 60000): void { // Default: check every minute
    if (this.intervalId) {
      appLogger.warn('Retry processor already running');
      return;
    }

    appLogger.info('Starting export retry processor', {
      operation: 'retry_processor_start',
      interval_ms: intervalMs
    });

    this.intervalId = setInterval(async () => {
      if (this.isProcessing) {
        appLogger.debug('Retry processor already running, skipping this interval');
        return;
      }

      try {
        await this.processRetries();
      } catch (error) {
        appLogger.error('Retry processor failed', {
          operation: 'retry_processor_error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, intervalMs);

    // Also run once immediately
    this.processRetries().catch(error => {
      appLogger.error('Initial retry processing failed', {
        operation: 'retry_processor_init',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    });
  }

  /**
   * Stop the retry processor
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      appLogger.info('Export retry processor stopped', {
        operation: 'retry_processor_stop'
      });
    }
  }

  /**
   * Process retry batches once
   */
  async processRetries(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      appLogger.debug('Processing export retries', { operation: 'retry_processor_run' });
      await this.exportService.processRetryBatches();
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get processing status
   */
  getStatus(): { running: boolean; processing: boolean } {
    return {
      running: this.intervalId !== undefined,
      processing: this.isProcessing
    };
  }
}

// Global instance
export const globalRetryProcessor = new RetryProcessor();