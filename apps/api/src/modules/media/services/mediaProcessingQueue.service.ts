import { createInMemoryQueue, createQueueName, type Queue } from "@zudojs/queue";

import type { AppSettings } from "../../../configs/settings.config.js";
import type { MediaProcessingScheduler } from "./mediaAssembly.service.js";
import type { MediaProcessingService } from "./mediaProcessing.service.js";

interface MediaProcessingJobData {
  readonly mediaId: string;
}

const PROCESS_MEDIA_JOB = "process-media";
const JOB_TIMEOUT_MS = 45 * 60_000;
const IDLE_POLL_MS = 5;

export interface MediaProcessingQueueOptions {
  readonly settings: AppSettings["media"];
  readonly keepProcessAlive: boolean;
}

export class MediaProcessingQueue implements MediaProcessingScheduler {
  private readonly queue: Queue<MediaProcessingJobData>;

  public constructor(
    processing: MediaProcessingService,
    private readonly options: MediaProcessingQueueOptions,
  ) {
    this.queue = createInMemoryQueue<MediaProcessingJobData>(createQueueName("media-processing"), {
      concurrency: options.settings.processingConcurrency,
      keepAlive: options.keepProcessAlive,
      timeoutGraceMs: 5_000,
    });
    this.queue.process(PROCESS_MEDIA_JOB, async (job, context) => {
      await processing.processMedia(job.data.mediaId, { attemptNumber: context.attemptNumber, maxAttempts: job.maxAttempts, signal: context.signal });
    });
  }

  public async enqueueProcessing(mediaId: string): Promise<void> {
    const { processingMaxAttempts, processingBackoffMs } = this.options.settings;
    await this.queue.add(PROCESS_MEDIA_JOB, { mediaId }, {
      attempts: processingMaxAttempts,
      backoff: { type: "exponential", delay: processingBackoffMs, maxDelay: processingBackoffMs * 64, jitter: "none" },
      timeout: JOB_TIMEOUT_MS,
    });
  }

  public async waitUntilIdle(timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const stats = await this.queue.getStats();
      if (stats.waiting + stats.active + stats.delayed + stats.retrying === 0) return;
      if (Date.now() > deadline) throw new Error(`Media processing did not finish within ${timeoutMs} ms.`);
      await new Promise((resolve) => setTimeout(resolve, IDLE_POLL_MS));
    }
  }

  public async countDeadLetteredJobs(): Promise<number> {
    return (await this.queue.getDeadLetterJobs()).length;
  }

  public close(): Promise<void> {
    return this.queue.close();
  }
}
