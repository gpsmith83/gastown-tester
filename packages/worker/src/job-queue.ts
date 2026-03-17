/**
 * Job Queue implementation for Gastown Tester Worker Runtime
 * Implements B-008: Establish worker runtime and job execution skeleton
 * Extended for B-604: Repository context ingestion job pipeline
 */

export interface JobData {
  id: string;
  type: string;
  payload: any;
  priority: number;
  retry_count: number;
  max_retries: number;
  created_at: Date;
  scheduled_for?: Date;
}

export interface JobResult {
  success: boolean;
  result?: any;
  error?: string;
  retry?: boolean;
  retry_delay?: number; // milliseconds
}

export interface JobHandler {
  process(data: JobData): Promise<JobResult>;
}

export interface JobHandlerClass {
  new (): JobHandler;
}

/**
 * In-memory job queue for MVP implementation
 * In production, this would be backed by Redis or a database
 */
export class JobQueue {
  private handlers: Map<string, JobHandlerClass> = new Map();
  private queue: JobData[] = [];
  private processing: Set<string> = new Set();
  private isRunning: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(private options = {
    pollInterval: 1000, // Check for jobs every 1 second
    maxConcurrent: 3    // Process max 3 jobs concurrently
  }) {}

  /**
   * Register a job handler for a specific job type
   */
  registerHandler(jobType: string, handlerClass: JobHandlerClass) {
    this.handlers.set(jobType, handlerClass);
    console.log(`📝 Registered handler for job type: ${jobType}`);
  }

  /**
   * Add a job to the queue
   */
  async enqueue(type: string, payload: any, options: {
    priority?: number;
    maxRetries?: number;
    delay?: number; // milliseconds
  } = {}): Promise<string> {
    const jobId = this.generateJobId();
    const now = new Date();
    const scheduledFor = options.delay ? new Date(now.getTime() + options.delay) : now;

    const job: JobData = {
      id: jobId,
      type,
      payload,
      priority: options.priority || 5,
      retry_count: 0,
      max_retries: options.maxRetries || 3,
      created_at: now,
      scheduled_for: scheduledFor
    };

    this.queue.push(job);
    this.sortQueue();

    console.log(`📋 Enqueued job ${jobId} of type ${type} (priority: ${job.priority})`);
    return jobId;
  }

  /**
   * Start the job queue processor
   */
  async start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    console.log('🔄 Starting job queue processor...');

    // Start the processing loop
    this.processingInterval = setInterval(() => {
      this.processNextJobs().catch(error => {
        console.error('❌ Error in job processing loop:', error);
      });
    }, this.options.pollInterval);
  }

  /**
   * Stop the job queue processor
   */
  async shutdown() {
    this.isRunning = false;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Wait for currently processing jobs to complete
    while (this.processing.size > 0) {
      console.log(`⏳ Waiting for ${this.processing.size} job(s) to complete...`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('✅ Job queue stopped');
  }

  /**
   * Process the next available jobs
   */
  private async processNextJobs() {
    if (!this.isRunning || this.processing.size >= this.options.maxConcurrent) {
      return;
    }

    const now = new Date();
    const availableJobs = this.queue.filter(job =>
      !this.processing.has(job.id) &&
      job.scheduled_for! <= now
    );

    if (availableJobs.length === 0) {
      return;
    }

    // Process jobs up to the concurrency limit
    const jobsToProcess = availableJobs.slice(0, this.options.maxConcurrent - this.processing.size);

    for (const job of jobsToProcess) {
      this.processJob(job).catch(error => {
        console.error(`❌ Fatal error processing job ${job.id}:`, error);
        this.removeJobFromQueue(job.id);
      });
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: JobData) {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      console.error(`❌ No handler registered for job type: ${job.type}`);
      this.removeJobFromQueue(job.id);
      return;
    }

    this.processing.add(job.id);
    console.log(`▶️ Processing job ${job.id} (type: ${job.type}, attempt: ${job.retry_count + 1})`);

    try {
      const handlerInstance = new handler();
      const result = await handlerInstance.process(job);

      if (result.success) {
        console.log(`✅ Job ${job.id} completed successfully`);
        this.removeJobFromQueue(job.id);
      } else {
        console.log(`⚠️ Job ${job.id} failed:`, result.error);
        await this.handleJobFailure(job, result);
      }
    } catch (error) {
      console.error(`❌ Job ${job.id} threw an error:`, error);
      await this.handleJobFailure(job, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retry: true
      });
    } finally {
      this.processing.delete(job.id);
    }
  }

  /**
   * Handle job failure and retry logic
   */
  private async handleJobFailure(job: JobData, result: JobResult) {
    if (result.retry && job.retry_count < job.max_retries) {
      job.retry_count++;
      const delay = result.retry_delay || (1000 * Math.pow(2, job.retry_count)); // Exponential backoff
      job.scheduled_for = new Date(Date.now() + delay);

      console.log(`🔄 Retrying job ${job.id} in ${delay}ms (attempt ${job.retry_count}/${job.max_retries})`);
      this.sortQueue();
    } else {
      console.error(`❌ Job ${job.id} failed permanently after ${job.retry_count} retries`);
      this.removeJobFromQueue(job.id);
    }
  }

  /**
   * Remove a job from the queue
   */
  private removeJobFromQueue(jobId: string) {
    const index = this.queue.findIndex(job => job.id === jobId);
    if (index >= 0) {
      this.queue.splice(index, 1);
    }
    this.processing.delete(jobId);
  }

  /**
   * Sort queue by priority (lower number = higher priority) and schedule time
   */
  private sortQueue() {
    this.queue.sort((a, b) => {
      // First by scheduled time
      const timeCompare = a.scheduled_for!.getTime() - b.scheduled_for!.getTime();
      if (timeCompare !== 0) return timeCompare;

      // Then by priority
      return a.priority - b.priority;
    });
  }

  /**
   * Generate a unique job ID
   */
  private generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get queue status for debugging
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing.size,
      isRunning: this.isRunning,
      handlers: Array.from(this.handlers.keys())
    };
  }
}