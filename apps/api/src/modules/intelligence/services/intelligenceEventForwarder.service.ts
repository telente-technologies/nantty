import { createInMemoryQueue, createQueueName, type Queue } from "@zudojs/queue";

import type { IntelligenceSettings } from "../../../configs/intelligence.config.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { IdentifierHasher, IntelligenceEventSink } from "../../../interfaces/intelligence.interface.js";
import type { AppLogger } from "../../../loggers/app.logger.js";
import type { EventIngestionResponse, IntelligenceEventInput } from "../models/intelligenceEvents.model.js";
import type { IntelligenceOutboxRepository } from "../repositories/intelligenceOutbox.repository.js";
import type { SignedIntelligenceClient } from "./intelligenceClient.service.js";
import { buildIntelligenceEventEnvelope } from "./intelligenceEnvelope.service.js";

const FORWARD_EVENTS_JOB = "forward-events";
const CLAIM_LEASE_MS = 10 * 60_000;
const IDLE_POLL_MS = 5;

interface ForwardEventsJobData {
  readonly eventIds: readonly string[];
}

export interface IntelligenceEventForwarderDependencies {
  readonly outbox: IntelligenceOutboxRepository;
  readonly client: SignedIntelligenceClient;
  readonly hasher: IdentifierHasher;
  readonly settings: IntelligenceSettings["events"];
  readonly clock: Clock;
  readonly logger: AppLogger;
  readonly keepProcessAlive: boolean;
}

class RetryableForwardingError extends Error {}

export class IntelligenceEventForwarder implements IntelligenceEventSink {
  private readonly queue: Queue<ForwardEventsJobData>;
  private flushing: Promise<void> | undefined;

  public constructor(private readonly dependencies: IntelligenceEventForwarderDependencies) {
    this.queue = createInMemoryQueue<ForwardEventsJobData>(createQueueName("intelligence-events"), { concurrency: 1, keepAlive: dependencies.keepProcessAlive });
    this.queue.process(FORWARD_EVENTS_JOB, async (job) => {
      await this.forwardBatch(job.data.eventIds);
    });
  }

  public async record(event: IntelligenceEventInput): Promise<void> {
    if (!this.dependencies.client.isEnabled()) return;
    const { outbox, hasher, clock, settings } = this.dependencies;
    await outbox.add([buildIntelligenceEventEnvelope(event, hasher)], clock.now());
    if ((await outbox.countAvailable(clock.now())) >= settings.batchSize) await this.flushPendingEvents();
  }

  public flushPendingEvents(): Promise<void> {
    this.flushing ??= this.claimAndEnqueueBatches().finally(() => {
      this.flushing = undefined;
    });
    return this.flushing;
  }

  public async waitUntilIdle(timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const stats = await this.queue.getStats();
      if (this.flushing === undefined && stats.waiting + stats.active + stats.delayed + stats.retrying === 0) return;
      if (Date.now() > deadline) throw new Error(`Intelligence event forwarding did not finish within ${timeoutMs} ms.`);
      await new Promise((resolve) => setTimeout(resolve, IDLE_POLL_MS));
    }
  }

  public async countDeadLetteredBatches(): Promise<number> {
    return (await this.queue.getDeadLetterJobs()).length;
  }

  public close(): Promise<void> {
    return this.queue.close();
  }

  private async claimAndEnqueueBatches(): Promise<void> {
    const { outbox, clock, settings } = this.dependencies;
    for (;;) {
      const now = clock.now();
      const eventIds = await outbox.claimAvailable(settings.batchSize, now, new Date(now.getTime() + CLAIM_LEASE_MS));
      if (eventIds.length === 0) return;
      await this.queue.add(FORWARD_EVENTS_JOB, { eventIds }, {
        attempts: settings.maxAttempts,
        backoff: { type: "exponential", delay: settings.retryBackoffMs, maxDelay: settings.retryBackoffMs * 64, jitter: "none" },
      });
    }
  }

  private async forwardBatch(eventIds: readonly string[]): Promise<void> {
    const { outbox, client, logger } = this.dependencies;
    const records = await outbox.findByIds(eventIds);
    if (records.length === 0) return;
    await outbox.recordAttempt(eventIds);
    const result = await client.post<EventIngestionResponse>("/v1/events", { events: records.map((record) => record.envelope) }, "eventsMs");
    if (result.ok) {
      const rejected = Array.isArray(result.value.rejected) ? result.value.rejected : [];
      if (rejected.length > 0) logger.warn("Intelligence rejected forwarded events; dropping them", { rejectedCount: rejected.length, reasons: rejected.map((entry) => entry.reason).slice(0, 5) });
      await outbox.deleteByIds(records.map((record) => record.eventId));
      return;
    }
    const permanent = result.reason === "http_error" && result.status !== undefined && result.status >= 400 && result.status < 500 && result.status !== 429 && result.status !== 401;
    if (permanent || result.reason === "disabled") {
      logger.warn("Intelligence refused an event batch permanently; dropping it", { status: result.status, eventCount: records.length });
      await outbox.deleteByIds(records.map((record) => record.eventId));
      return;
    }
    throw new RetryableForwardingError(`Forwarding events failed (${result.reason}); will retry with the same event ids.`);
  }
}
