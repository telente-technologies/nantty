import { randomUUID } from "node:crypto";

import type { IdentifierHasher } from "../../../interfaces/intelligence.interface.js";
import type { IntelligenceEventEnvelope, IntelligenceEventInput } from "../models/intelligenceEvents.model.js";

const TOPIC_SLUG_PATTERN = /^[a-z0-9_-]{1,64}$/;
const MAXIMUM_TOPICS_PER_ITEM = 20;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;

export function sanitizeTopicSlugs(values: readonly string[] | undefined): string[] {
  const slugs = (values ?? []).map((value) => value.trim().toLowerCase().replace(/^#/, "")).filter((value) => TOPIC_SLUG_PATTERN.test(value));
  return [...new Set(slugs)].slice(0, MAXIMUM_TOPICS_PER_ITEM);
}

function withoutUndefinedFields(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function renameUserFields(payload: Readonly<Record<string, unknown>>, hasher: IdentifierHasher): Record<string, unknown> {
  const renamed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key.endsWith("UserId") && typeof value === "string") renamed[key.replace(/UserId$/, "Id")] = hasher.hashUserId(value);
    else if ((key === "topics" || key === "hashtags") && Array.isArray(value)) renamed[key] = sanitizeTopicSlugs(value as string[]);
    else renamed[key] = value;
  }
  return renamed;
}

function buildPayload(input: IntelligenceEventInput, hasher: IdentifierHasher): Record<string, unknown> {
  if (input.eventType === "searched") {
    return { queryHash: hasher.hashSearchQuery(input.payload.queryText), resultCount: input.payload.resultCount };
  }
  if (input.eventType === "followed" && input.payload.targetKind === "user") {
    return { targetAccountId: hasher.hashUserId(input.payload.targetAccountId), targetKind: "user" };
  }
  return renameUserFields(input.payload as unknown as Readonly<Record<string, unknown>>, hasher);
}

export function buildIntelligenceEventEnvelope(input: IntelligenceEventInput, hasher: IdentifierHasher): IntelligenceEventEnvelope {
  const country = input.country?.toUpperCase();
  return {
    eventId: input.eventId ?? `evt_${randomUUID().replaceAll("-", "")}`,
    eventType: input.eventType,
    eventVersion: 1,
    occurredAt: input.occurredAt.toISOString(),
    producer: "api",
    actorId: hasher.hashUserId(input.actorUserId),
    ...(country !== undefined && COUNTRY_PATTERN.test(country) ? { country } : {}),
    ...(input.context === undefined ? {} : { context: input.context }),
    payload: withoutUndefinedFields(buildPayload(input, hasher)),
  };
}
