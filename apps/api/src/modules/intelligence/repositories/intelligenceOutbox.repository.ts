import type { IntelligenceEventEnvelope } from "../models/intelligenceEvents.model.js";

export interface OutboxEventRecord {
  readonly eventId: string;
  readonly envelope: IntelligenceEventEnvelope;
  readonly attempts: number;
  readonly availableAt: Date;
  readonly createdAt: Date;
}

export interface IntelligenceOutboxRepository {
  add(envelopes: readonly IntelligenceEventEnvelope[], now: Date): Promise<void>;
  claimAvailable(limit: number, now: Date, leaseUntil: Date): Promise<readonly string[]>;
  findByIds(eventIds: readonly string[]): Promise<readonly OutboxEventRecord[]>;
  recordAttempt(eventIds: readonly string[]): Promise<void>;
  deleteByIds(eventIds: readonly string[]): Promise<void>;
  countAvailable(now: Date): Promise<number>;
}

export class InMemoryIntelligenceOutboxRepository implements IntelligenceOutboxRepository {
  private readonly events = new Map<string, OutboxEventRecord>();

  public async add(envelopes: readonly IntelligenceEventEnvelope[], now: Date): Promise<void> {
    for (const envelope of envelopes) {
      if (!this.events.has(envelope.eventId)) this.events.set(envelope.eventId, { eventId: envelope.eventId, envelope, attempts: 0, availableAt: now, createdAt: now });
    }
  }

  public async claimAvailable(limit: number, now: Date, leaseUntil: Date): Promise<readonly string[]> {
    const claimed = [...this.events.values()]
      .filter((event) => event.availableAt <= now)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .slice(0, limit);
    for (const event of claimed) this.events.set(event.eventId, { ...event, availableAt: leaseUntil });
    return claimed.map((event) => event.eventId);
  }

  public async findByIds(eventIds: readonly string[]): Promise<readonly OutboxEventRecord[]> {
    return eventIds.map((eventId) => this.events.get(eventId)).filter((event): event is OutboxEventRecord => event !== undefined);
  }

  public async recordAttempt(eventIds: readonly string[]): Promise<void> {
    for (const eventId of eventIds) {
      const event = this.events.get(eventId);
      if (event !== undefined) this.events.set(eventId, { ...event, attempts: event.attempts + 1 });
    }
  }

  public async deleteByIds(eventIds: readonly string[]): Promise<void> {
    for (const eventId of eventIds) this.events.delete(eventId);
  }

  public async countAvailable(now: Date): Promise<number> {
    return [...this.events.values()].filter((event) => event.availableAt <= now).length;
  }
}
