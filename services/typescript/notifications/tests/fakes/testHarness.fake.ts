import type { Logger } from "@nantty/fastify-platform";

import { EmailDeliveryService } from "../../src/modules/delivery/services/emailDelivery.service.js";
import { NotificationDispatcherService } from "../../src/modules/delivery/services/notificationDispatcher.service.js";
import { UnsubscribeTokenService } from "../../src/modules/unsubscribe/services/unsubscribeToken.service.js";
import { failedEmailAlertJobType, supportTicketAlertJobType, templateEmailJobType } from "../../src/constants/delivery.constant.js";
import { DeliverTemplateEmailHandler } from "../../src/modules/delivery/commands/deliverTemplateEmail/deliverTemplateEmail.handler.js";
import { SupportInboxAlertService } from "../../src/modules/delivery/services/supportInboxAlert.service.js";
import type { DomainEventEnvelope } from "../../src/types/domainEvent.type.js";
import {
  InMemoryCampaignRepository, InMemoryDeliveryRepository, InMemoryDeviceTokenRepository, InMemoryNoticeDraftRepository, InMemoryNotificationRepository, InMemoryPreferenceRepository, InMemorySuppressionRepository, InMemoryUnsubscribeReceiptRepository,
} from "./inMemoryRepositories.fake.js";
import { FakeIdentityDirectory, RecordingEmailSender, RecordingJobQueue, RecordingPushSender } from "./inMemoryServices.fake.js";

export const silentLogger = { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined } as unknown as Logger;

export function createTestHarness() {
  const notifications = new InMemoryNotificationRepository();
  const deliveries = new InMemoryDeliveryRepository();
  const preferences = new InMemoryPreferenceRepository();
  const deviceTokens = new InMemoryDeviceTokenRepository();
  const suppressions = new InMemorySuppressionRepository();
  const campaigns = new InMemoryCampaignRepository();
  const drafts = new InMemoryNoticeDraftRepository();
  const unsubscribeReceipts = new InMemoryUnsubscribeReceiptRepository();
  const identity = new FakeIdentityDirectory();
  const sender = new RecordingEmailSender();
  const pushSender = new RecordingPushSender();
  const jobQueue = new RecordingJobQueue();
  const unsubscribeTokens = new UnsubscribeTokenService("test-signing-secret-that-is-long-enough-0123", "https://api.nantty.test");
  const clock = { current: new Date("2026-10-03T12:00:00.000Z") };
  const now = () => clock.current;
  deliveries.now = now;
  const emailDelivery = new EmailDeliveryService({ sender, deliveries, suppressions, preferences, unsubscribeTokens, marketingMaxPerWeek: 2, now });
  const dispatcher = new NotificationDispatcherService({ notifications, deliveries, preferences, deviceTokens, identity, emailDelivery, pushSender, jobQueue, jobsQueueUrl: "jobs-queue", now });
  return { notifications, deliveries, preferences, deviceTokens, suppressions, campaigns, drafts, unsubscribeReceipts, identity, sender, pushSender, jobQueue, unsubscribeTokens, clock, now, emailDelivery, dispatcher };
}

export type TestHarness = ReturnType<typeof createTestHarness>;

export async function runQueuedTemplateEmails(harness: TestHarness, inbox?: SupportInboxAlertService): Promise<void> {
  const queued = harness.jobQueue.jobs.splice(0);
  const deliveryJobs = queued.filter((job) => [templateEmailJobType, supportTicketAlertJobType, failedEmailAlertJobType].includes(String(job.body["type"])));
  harness.jobQueue.jobs.push(...queued.filter((job) => ![templateEmailJobType, supportTicketAlertJobType, failedEmailAlertJobType].includes(String(job.body["type"]))));
  const supportInbox = inbox ?? new SupportInboxAlertService({ emailDelivery: harness.emailDelivery, recipients: ["support@nantty.test"], adminBaseUrl: "https://admin.nantty.test", jobQueue: harness.jobQueue, jobsQueueUrl: "jobs-queue" });
  const handler = new DeliverTemplateEmailHandler({
    identity: harness.identity,
    emailDelivery: harness.emailDelivery,
    jobQueue: harness.jobQueue,
    jobsQueueUrl: "jobs-queue",
    supportInbox,
    logger: silentLogger,
  });
  for (const job of deliveryJobs) {
    if (job.body["type"] === templateEmailJobType) await handler.execute(job.body as never);
    else if (job.body["type"] === supportTicketAlertJobType) await supportInbox.deliverTicketCreated(job.body["event"] as never);
    else await supportInbox.deliverEmailDeliveryFailed(job.body as never);
  }
  const failureAlerts = harness.jobQueue.jobs.filter((job) => job.body["type"] === failedEmailAlertJobType);
  harness.jobQueue.jobs.splice(0, harness.jobQueue.jobs.length, ...harness.jobQueue.jobs.filter((job) => job.body["type"] !== failedEmailAlertJobType));
  for (const job of failureAlerts) await supportInbox.deliverEmailDeliveryFailed(job.body as never);
}

export function makeEvent(type: string, data: Record<string, unknown>, id = `evt-${type}`): DomainEventEnvelope {
  return { id, type, source: "test", subject: type, schemaVersion: 1, occurredAt: "2026-10-03T11:59:00.000Z", data };
}
