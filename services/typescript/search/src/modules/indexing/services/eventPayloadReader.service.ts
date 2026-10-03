import { PoisonEventError } from "../../../errors/search.error.js";
import type { DomainEventEnvelope } from "../../../types/domainEvent.type.js";

export function readRequiredString(envelope: DomainEventEnvelope, field: string): string {
  const value = envelope.data[field];
  if (typeof value !== "string" || value === "") throw new PoisonEventError(`${envelope.type} is missing ${field}`);
  return value;
}

export function readOptionalString(envelope: DomainEventEnvelope, field: string): string | undefined {
  const value = envelope.data[field];
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function readBoolean(envelope: DomainEventEnvelope, field: string): boolean {
  const value = envelope.data[field];
  if (typeof value !== "boolean") throw new PoisonEventError(`${envelope.type} is missing ${field}`);
  return value;
}

export function readEventVersion(envelope: DomainEventEnvelope, fallbackMilliseconds: number): number {
  const parsed = Date.parse(envelope.occurredAt);
  return Number.isNaN(parsed) ? fallbackMilliseconds : parsed;
}

export function parseEnvelope(body: string): DomainEventEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new PoisonEventError("event body is not JSON");
  }
  const candidate = parsed as Partial<DomainEventEnvelope> | null;
  if (candidate === null || typeof candidate !== "object" || typeof candidate.id !== "string" || typeof candidate.type !== "string" || typeof candidate.data !== "object" || candidate.data === null) throw new PoisonEventError("event is not an envelope.v1");
  return { id: candidate.id, type: candidate.type, source: candidate.source ?? "", subject: candidate.subject ?? "", schemaVersion: candidate.schemaVersion ?? 1, occurredAt: candidate.occurredAt ?? new Date().toISOString(), data: candidate.data as Record<string, unknown> };
}
