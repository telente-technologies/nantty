import type { EventBus } from "@zudojs/events";

import type { Clock } from "../../../interfaces/clock.interface.js";
import type { UserAccountStandingLookup } from "../../../interfaces/userDirectory.interface.js";
import { subscribeToEvent } from "../../../loaders/events.loader.js";
import { MessageSentEvent } from "../../messages/events/messageSent.event.js";
import { ModerationReportSubmittedEvent } from "../../moderation/events/moderationEvents.event.js";
import { SellerApplicationSubmittedEvent } from "../../stores/events/sellerApplicationSubmitted.event.js";
import { StoreCreatedEvent } from "../../stores/events/storeCreated.event.js";
import type { AutomationEventData } from "../models/automation.model.js";
import type { AutomationEngine } from "../services/automationEngine.service.js";

const DAY_IN_MILLISECONDS = 86_400_000;

export interface AutomationSignalSources {
  readonly accountStanding: UserAccountStandingLookup;
  readonly countModerationStrikes: (userId: string) => Promise<number>;
  readonly clock: Clock;
}

async function describeAccountRisk(sources: AutomationSignalSources, userId: string): Promise<AutomationEventData> {
  const [standing, moderationStrikes] = await Promise.all([sources.accountStanding.findUserAccountStanding(userId), sources.countModerationStrikes(userId)]);
  return {
    accountAgeDays: standing === undefined ? 0 : Math.floor((sources.clock.now().getTime() - standing.createdAt.getTime()) / DAY_IN_MILLISECONDS),
    emailVerified: standing?.emailVerified ?? false,
    phoneVerified: standing?.phoneVerified ?? false,
    moderationStrikes,
  };
}

export function subscribeAutomationTriggers(events: EventBus, engine: AutomationEngine, sources: AutomationSignalSources): void {
  subscribeToEvent(events, ModerationReportSubmittedEvent, (report) =>
    engine.handleEvent({
      trigger: "moderation.report_submitted",
      subjectKey: `${report.targetType}:${report.targetId}`,
      data: { targetType: report.targetType, targetId: report.targetId, targetOwnerId: report.targetOwnerId, reporterId: report.reporterId, reason: report.reason },
    }),
  );
  subscribeToEvent(events, StoreCreatedEvent, async (store) =>
    engine.handleEvent({
      trigger: "stores.store_created",
      subjectKey: `user:${store.ownerId}`,
      data: { storeId: store.storeId, ownerId: store.ownerId, ...(await describeAccountRisk(sources, store.ownerId)) },
    }),
  );
  subscribeToEvent(events, SellerApplicationSubmittedEvent, async (application) =>
    engine.handleEvent({
      trigger: "stores.seller_application_submitted",
      subjectKey: `user:${application.userId}`,
      data: { applicationId: application.applicationId, userId: application.userId, ...(await describeAccountRisk(sources, application.userId)) },
    }),
  );
  subscribeToEvent(events, MessageSentEvent, (message) =>
    engine.handleEvent({
      trigger: "messages.message_sent",
      subjectKey: `user:${message.senderId}`,
      data: { senderId: message.senderId, conversationId: message.conversationId, conversationKind: message.conversationKind, recipientCount: message.recipientIds.length },
    }),
  );
}
