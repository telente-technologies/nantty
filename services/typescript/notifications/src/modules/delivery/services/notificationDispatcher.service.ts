import { defaultPushEnabledByCategory } from "../../../constants/notificationCategories.constant.js";
import { templateEmailJobType, unreadEmailJobType } from "../../../constants/delivery.constant.js";
import { MissingEventFieldError } from "../../../errors/notifications.error.js";
import type { IdentityDirectory } from "../../../interfaces/identityDirectory.interface.js";
import type { JobQueue } from "../../../interfaces/jobQueue.interface.js";
import type { PushProvider, PushSender, PushSendResult } from "../../../interfaces/pushSender.interface.js";
import type { DeliveryRepository, DeviceTokenRepository, NotificationRepository, PreferenceRepository } from "../../../interfaces/repositories.interface.js";
import type { EmailPlan, NotificationIntent, Recipient } from "../../../types/notification.type.js";
import { normalizePushProviderCode } from "../../../utils/pushFailure.util.js";
import type { EmailDeliveryService } from "./emailDelivery.service.js";

export interface DispatchOutcome {
  readonly inApp: "created" | "duplicate" | "none";
  readonly email: string;
  readonly push: string;
}

export class NotificationDispatcherService {
  public constructor(
    private readonly deps: {
      readonly notifications: NotificationRepository;
      readonly deliveries: DeliveryRepository;
      readonly preferences: PreferenceRepository;
      readonly deviceTokens: DeviceTokenRepository;
      readonly identity: IdentityDirectory;
      readonly emailDelivery: EmailDeliveryService;
      readonly pushSender: PushSender;
      readonly jobQueue: JobQueue;
      readonly jobsQueueUrl: string;
      readonly now?: () => Date;
    },
  ) {}

  public async dispatch(intent: NotificationIntent): Promise<DispatchOutcome> {
    const variant = intent.variant ?? "main";
    const baseKey = `${intent.eventId}:${intent.recipientUserId}`;
    const inApp = await this.createInApp(intent, `${baseKey}:${variant}`);
    const email = await this.sendEmail(intent, baseKey, variant);
    const push = await this.sendPush(intent, baseKey, variant);
    return { inApp, email, push };
  }

  private async createInApp(intent: NotificationIntent, dedupeKey: string): Promise<DispatchOutcome["inApp"]> {
    if (intent.inApp === undefined) return "none";
    const created = await this.deps.notifications.insertIfAbsent({
      userId: intent.recipientUserId,
      dedupeKey,
      category: intent.inApp.category,
      kind: intent.inApp.kind ?? null,
      templateKey: null,
      title: intent.inApp.title,
      body: intent.inApp.body,
      actor: intent.inApp.actor ?? null,
      data: { ...(intent.inApp.data ?? {}) },
    });
    return created === null ? "duplicate" : "created";
  }

  private async sendEmail(intent: NotificationIntent, baseKey: string, variant: string): Promise<string> {
    if (intent.email === undefined) return "none";
    const recipient = await this.resolveRecipient(intent);
    if (recipient === null) return "skipped:recipient_not_found";
    let plan: EmailPlan;
    try {
      plan = intent.email(recipient);
    } catch (error) {
      if (error instanceof MissingEventFieldError) return `skipped:incomplete_event_data:${error.fieldPath}`;
      throw error;
    }
    const dedupeKey = `${baseKey}:email:${variant}`;
    if (plan.deliverIfUnreadAfterMinutes !== undefined) {
      await this.scheduleEmailIfStillUnread(intent, plan, `${baseKey}:${variant}`, dedupeKey);
      return "scheduled";
    }
    if (intent.emailAddressOverride === undefined) {
      await this.deps.jobQueue.send(this.deps.jobsQueueUrl, {
        type: templateEmailJobType,
        dedupeKey,
        eventId: intent.eventId,
        userId: intent.recipientUserId,
        preferenceCategory: intent.preferenceCategory,
        templateKey: plan.templateKey,
        props: plan.props,
        attempt: 1,
      });
      return "queued";
    }
    const outcome = await this.deps.emailDelivery.deliver({
      dedupeKey, eventId: intent.eventId, recipient, addressVerifiedByFlow: intent.emailAddressOverride !== undefined,
      preferenceCategory: intent.preferenceCategory, templateKey: plan.templateKey, props: plan.props,
    });
    return outcome.reason === undefined ? outcome.status : `${outcome.status}:${outcome.reason}`;
  }

  private async resolveRecipient(intent: NotificationIntent): Promise<Recipient | null> {
    const fromIdentity = await this.deps.identity.getRecipient(intent.recipientUserId);
    if (intent.emailAddressOverride === undefined) return fromIdentity;
    return {
      accountId: intent.recipientUserId, firstName: fromIdentity?.firstName ?? "there", username: fromIdentity?.username ?? "",
      marketingConsent: false, status: fromIdentity?.status ?? "pending", email: intent.emailAddressOverride, emailVerified: true,
    };
  }

  private async scheduleEmailIfStillUnread(intent: NotificationIntent, plan: EmailPlan, notificationKey: string, emailDedupeKey: string): Promise<void> {
    const notBefore = new Date((this.deps.now ?? (() => new Date()))().getTime() + (plan.deliverIfUnreadAfterMinutes ?? 0) * 60_000);
    await this.deps.jobQueue.send(this.deps.jobsQueueUrl, {
      type: unreadEmailJobType, eventId: intent.eventId, userId: intent.recipientUserId, preferenceCategory: intent.preferenceCategory,
      notificationKey, emailDedupeKey, templateKey: plan.templateKey, props: plan.props, notBefore: notBefore.toISOString(),
      attempt: 1,
    }, 900);
  }

  private async sendPush(intent: NotificationIntent, baseKey: string, variant: string): Promise<string> {
    if (intent.push === undefined) return "none";
    const preference = (await this.deps.preferences.list(intent.recipientUserId)).find((row) => row.category === intent.preferenceCategory);
    if (!(preference?.push ?? defaultPushEnabledByCategory[intent.preferenceCategory])) return "skipped:preference_disabled";
    if ((await this.deps.identity.getRecipient(intent.recipientUserId))?.pushEnabled === false) return "skipped:push_turned_off";
    const claim = await this.deps.deliveries.claim({ dedupeKey: `${baseKey}:push:${variant}`, eventId: intent.eventId, userId: intent.recipientUserId, channel: "push", templateKey: null, mailKind: null });
    if (claim.alreadyProcessed) return "duplicate";
    const registrations = await this.deps.deviceTokens.listRegistrations(intent.recipientUserId);
    if (registrations.length === 0) {
      await this.deps.deliveries.finish(claim.id, "skipped", { skipReason: "no_device_tokens" });
      return "skipped:no_device_tokens";
    }
    let simulated = false;
    const failures: { provider: PushProvider; failure: PushSendResult["failures"][number] }[] = [];
    for (const [provider, tokens] of groupRegistrations(registrations)) {
      let result: PushSendResult;
      try {
        result = await this.deps.pushSender.send(tokens, intent.push, provider);
      } catch {
        await this.deps.deliveries.finish(claim.id, "failed", { skipReason: `${provider}_push_transport_error:retryable` });
        return "failed";
      }
      simulated ||= result.simulated === true;
      failures.push(...result.failures.map((failure) => ({ provider, failure })));
      const pruneFailures = await this.removeInvalidTokens(intent.recipientUserId, provider, result.failures);
      if (pruneFailures > 0) {
        await this.deps.deliveries.finish(claim.id, "failed", { skipReason: `push_provider_failure:${provider}:permanent:TOKEN_PRUNE_FAILED:${pruneFailures}`.slice(0, 200) });
        return "failed";
      }
    }
    if (failures.length > 0) {
      const summary = summarizePushFailures(failures);
      await this.deps.deliveries.finish(claim.id, "failed", { skipReason: summary });
      return "failed";
    }
    if (simulated) {
      await this.deps.deliveries.finish(claim.id, "skipped", { skipReason: "push_provider_log_only" });
      return "skipped:push_provider_log_only";
    }
    await this.deps.deliveries.finish(claim.id, "sent", {});
    return "sent";
  }

  private async removeInvalidTokens(userId: string, provider: PushProvider, failures: readonly { readonly token: string; readonly code: string }[]): Promise<number> {
    let failed = 0;
    for (const failure of failures) {
      if (!isUnregisteredToken(provider, failure.code)) continue;
      try {
        await this.deps.deviceTokens.remove(userId, failure.token, provider);
      } catch {
        failed += 1;
      }
    }
    return failed;
  }
}

function groupRegistrations(registrations: readonly { readonly token: string; readonly provider: PushProvider }[]): Map<PushProvider, string[]> {
  const grouped = new Map<PushProvider, string[]>();
  for (const registration of registrations) {
    const group = grouped.get(registration.provider) ?? [];
    group.push(registration.token);
    grouped.set(registration.provider, group);
  }
  return grouped;
}

function isUnregisteredToken(provider: PushProvider, code: string): boolean {
  return provider === "expo" ? code === "DeviceNotRegistered" : code === "UNREGISTERED";
}

function summarizePushFailures(failures: readonly { readonly provider: PushProvider; readonly failure: { readonly classification: string; readonly code: string } }[]): string {
  const counts = new Map<string, number>();
  for (const { provider, failure } of failures) {
    const key = `${provider}:${failure.classification}:${normalizePushProviderCode(failure.code)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return `push_provider_failure:${[...counts].map(([key, count]) => `${key}:${count}`).join(",")}`.slice(0, 200);
}
