import type { EmailTemplateKey, EmailTemplateProps } from "@nantty/email-templates";

import type { DomainEventEnvelope } from "../../../types/domainEvent.type.js";
import type { ActorSummary, EmailPlan, InAppContent, NotificationIntent, PreferenceCategory, PushContent, Recipient } from "../../../types/notification.type.js";
import { EventDataReader } from "../../../utils/eventDataReader.util.js";

export interface MappingContext {
  readonly webBaseUrl: string;
  readonly sellerDashboardUrl: string;
  readonly otpEnvelopeKeys?: Readonly<Record<string, Buffer>>;
}

export type EventMapping = (event: DomainEventEnvelope, data: EventDataReader, context: MappingContext) => NotificationIntent[];

export function plan<K extends EmailTemplateKey>(templateKey: K, props: EmailTemplateProps<K>, deliverIfUnreadAfterMinutes?: number): EmailPlan {
  return { templateKey, props, ...(deliverIfUnreadAfterMinutes === undefined ? {} : { deliverIfUnreadAfterMinutes }) };
}

export interface IntentParts {
  readonly category: PreferenceCategory;
  readonly inApp?: InAppContent;
  readonly push?: PushContent;
  readonly email?: (recipient: Recipient) => EmailPlan;
  readonly variant?: string;
  readonly emailAddressOverride?: string;
}

export function intentFor(event: DomainEventEnvelope, recipientUserId: string, parts: IntentParts): NotificationIntent {
  return {
    eventId: event.id,
    recipientUserId,
    preferenceCategory: parts.category,
    ...(parts.variant === undefined ? {} : { variant: parts.variant }),
    ...(parts.inApp === undefined ? {} : { inApp: parts.inApp }),
    ...(parts.push === undefined ? {} : { push: parts.push }),
    ...(parts.email === undefined ? {} : { email: parts.email }),
    ...(parts.emailAddressOverride === undefined ? {} : { emailAddressOverride: parts.emailAddressOverride }),
  };
}

export function readActor(reader: EventDataReader, key = "actor"): ActorSummary | null {
  const actor = reader.optionalObject(key);
  if (actor === undefined) return null;
  const avatarUrl = actor.optionalText("avatarUrl");
  const username = actor.optionalText("username");
  return {
    id: actor.text("id"),
    name: actor.text("name", username ?? "Someone"),
    ...(username === undefined ? {} : { username }),
    ...(avatarUrl === undefined ? {} : { avatarUrl }),
  };
}

export function orderUrl(context: MappingContext, orderId: string): string {
  return `${context.webBaseUrl}/orders/${orderId}`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
