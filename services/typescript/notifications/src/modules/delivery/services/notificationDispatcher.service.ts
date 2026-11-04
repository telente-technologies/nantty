import { defaultPushEnabledByCategory } from "../../../constants/notificationCategories.constant.js";
import { templateEmailJobType, unreadEmailJobType } from "../../../constants/delivery.constant.js";
import { MissingEventFieldError } from "../../../errors/notifications.error.js";
import type { IdentityDirectory } from "../../../interfaces/identityDirectory.interface.js";
import type { JobQueue } from "../../../interfaces/jobQueue.interface.js";
import type { PushSender } from "../../../interfaces/pushSender.interface.js";
import type { DeliveryRepository, DeviceTokenRepository, NotificationRepository, PreferenceRepository } from "../../../interfaces/repositories.interface.js";
import type { EmailPlan, NotificationIntent, Recipient } from "../../../types/notification.type.js";
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
    const tokens = await this.deps.deviceTokens.listTokens(intent.recipientUserId);
    if (tokens.length === 0) {
      await this.deps.deliveries.finish(claim.id, "skipped", { skipReason: "no_device_tokens" });
      return "skipped:no_device_tokens";
    }
    try {
      await this.deps.pushSender.send(tokens, intent.push);
      await this.deps.deliveries.finish(claim.id, "sent", {});
      return "sent";
    } catch (error) {
      await this.deps.deliveries.finish(claim.id, "failed", { skipReason: error instanceof Error ? error.message.slice(0, 200) : "push_failed" });
      return "failed";
    }
  }
}
