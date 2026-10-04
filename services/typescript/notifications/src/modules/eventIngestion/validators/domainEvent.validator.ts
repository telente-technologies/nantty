import { z } from "zod";

import type { DomainEventEnvelope } from "../../../types/domainEvent.type.js";

const envelopeSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.string().regex(/^[a-z][A-Za-z]*\.[A-Za-z]+$/),
  source: z.string().default("unknown"),
  subject: z.string().default(""),
  schemaVersion: z.number().int().min(1).default(1),
  occurredAt: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
});

export function parseDomainEventEnvelope(value: unknown): DomainEventEnvelope | null {
  const result = envelopeSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function unwrapQueueMessageBody(body: string): unknown {
  const parsed: unknown = JSON.parse(body);
  if (typeof parsed === "object" && parsed !== null && (parsed as Record<string, unknown>)["Type"] === "Notification" && typeof (parsed as Record<string, unknown>)["Message"] === "string") {
    return JSON.parse((parsed as { Message: string }).Message);
  }
  return parsed;
}
