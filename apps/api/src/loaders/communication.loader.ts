import { NotificationRequestedEvent } from "../events/notificationRequested.event.js";
import type { AuditRecorder } from "../interfaces/audit.interface.js";
import type { MediaLibrary } from "../interfaces/mediaLibrary.interface.js";
import type { ModerationTargetGateway } from "../interfaces/moderationTargets.interface.js";
import type { AccessTokenVerifier } from "../interfaces/principal.interface.js";
import type { RealtimePublisher } from "../interfaces/realtimePublisher.interface.js";
import type { StoreAccess } from "../interfaces/storeAccess.interface.js";
import type { SocialGraph } from "../interfaces/socialGraph.interface.js";
import type { UserAccountStandingLookup, UserDirectory } from "../interfaces/userDirectory.interface.js";
import { UserRegisteredEvent } from "../modules/auth/events/userRegistered.event.js";
import { EmailChannel, IntegrationNotificationEmailSender, type NotificationEmailSender } from "../modules/notifications/channels/email.channel.js";
import { InAppChannel } from "../modules/notifications/channels/inApp.channel.js";
import { PushChannel, UnconfiguredPushSender, type PushSender } from "../modules/notifications/channels/push.channel.js";
import { SendNotificationCommand } from "../modules/notifications/commands/sendNotification/sendNotification.command.js";
import { NotificationsController } from "../modules/notifications/controllers/notifications.controller.js";
import { convertNotificationToDto } from "../modules/notifications/dtos/notifications.dto.js";
import type { NotificationRecord } from "../modules/notifications/models/notifications.model.js";
import { registerNotificationsCommandAndQueryHandlers } from "../modules/notifications/notifications.module.js";
import { InMemoryDeviceTokensRepository, PrismaDeviceTokensRepository } from "../modules/notifications/repositories/deviceTokens.repository.js";
import { PrismaNotificationsRepository } from "../modules/notifications/repositories/notifications.prisma.repository.js";
import { InMemoryNotificationsRepository } from "../modules/notifications/repositories/notifications.repository.js";
import { NotificationsService } from "../modules/notifications/services/notifications.service.js";
import { WaitlistController } from "../modules/waitlist/controllers/waitlist.controller.js";
import { PrismaWaitlistRepository } from "../modules/waitlist/repositories/waitlist.prisma.repository.js";
import { InMemoryWaitlistRepository } from "../modules/waitlist/repositories/waitlist.repository.js";
import { WaitlistService } from "../modules/waitlist/services/waitlist.service.js";
import { registerWaitlistCommandAndQueryHandlers } from "../modules/waitlist/waitlist.module.js";
import type { Core } from "./core.loader.js";
import { subscribeToEvent } from "./events.loader.js";
import { createMessagingModule } from "./messaging.loader.js";
import { createTrustAndSafetyModules, type TrustAndSafetyExternalServices } from "./trustAndSafety.loader.js";
import type { ModerationDecisionsRepository } from "../modules/moderation/repositories/decisions.repository.js";

export interface CommunicationExternalServices extends TrustAndSafetyExternalServices {
  readonly pushSender?: PushSender;
  readonly notificationEmailSender?: NotificationEmailSender;
}

export interface CommunicationSharedServices {
  readonly audit: AuditRecorder;
  readonly userDirectory: UserDirectory & UserAccountStandingLookup;
  readonly socialGraph: SocialGraph;
  readonly storeAccess: StoreAccess;
  readonly mediaLibrary: MediaLibrary;
  readonly accessTokenVerifier: AccessTokenVerifier;
  readonly moderationDecisions: ModerationDecisionsRepository;
  readonly moderationTargets: readonly ModerationTargetGateway[];
}

function createNotificationsModule(
  core: Core,
  shared: CommunicationSharedServices,
  external: CommunicationExternalServices,
  realtime: RealtimePublisher,
): NotificationsService {
  const usePrisma = core.persistence === "prisma";
  const notifications = usePrisma ? new PrismaNotificationsRepository() : new InMemoryNotificationsRepository();
  const deviceTokens = usePrisma ? new PrismaDeviceTokensRepository() : new InMemoryDeviceTokensRepository();
  const service = new NotificationsService({
    notifications,
    deviceTokens,
    userDirectory: shared.userDirectory,
    inAppChannel: new InAppChannel(notifications, core.clock),
    pushChannel: new PushChannel(deviceTokens, external.pushSender ?? new UnconfiguredPushSender(core.logger)),
    emailChannel: new EmailChannel(external.notificationEmailSender ?? new IntegrationNotificationEmailSender()),
    clock: core.clock,
    logger: core.logger,
  });
  registerNotificationsCommandAndQueryHandlers(core.commands, core.queries, service);
  subscribeToEvent(core.events, NotificationRequestedEvent, async (request) => {
    const delivered = await core.commands.execute<SendNotificationCommand, NotificationRecord | undefined>(new SendNotificationCommand(request));
    if (delivered !== undefined) realtime.publishToUser(delivered.userId, { type: "notification.created", notification: convertNotificationToDto(delivered) });
  });
  subscribeToEvent(core.events, UserRegisteredEvent, async (registration) => {
    await core.commands.execute(
      new SendNotificationCommand({
        userId: registration.userId,
        category: "social",
        title: "Welcome to Zudomart",
        body: "Follow creators and stores you love, and shop safely with escrow-protected payments.",
      }),
    );
  });
  return service;
}

export function createCommunicationModules(core: Core, shared: CommunicationSharedServices, external: CommunicationExternalServices) {
  const messaging = createMessagingModule(core, shared);
  createNotificationsModule(core, shared, external, messaging.realtimeHub);
  const trustAndSafety = createTrustAndSafetyModules(
    core,
    { ...shared, realtime: messaging.realtimeHub, moderationTargets: [messaging.messageModerationTarget, ...shared.moderationTargets] },
    external,
  );
  const usePrisma = core.persistence === "prisma";
  const waitlistService = new WaitlistService({
    entries: usePrisma ? new PrismaWaitlistRepository() : new InMemoryWaitlistRepository(),
    events: core.events,
    clock: core.clock,
  });
  registerWaitlistCommandAndQueryHandlers(core.commands, core.queries, waitlistService);
  return {
    realtimeHub: messaging.realtimeHub,
    supportInbox: trustAndSafety.supportInbox,
    moderationQueue: trustAndSafety.moderationQueue,
    accountSuspensions: trustAndSafety.accountSuspensions,
    scheduledJobs: [...messaging.scheduledJobs, ...trustAndSafety.scheduledJobs],
    controllers: {
      notificationsController: new NotificationsController(core.commands, core.queries),
      ...messaging.controllers,
      ...trustAndSafety.controllers,
      waitlistController: new WaitlistController(core.commands, core.queries),
    },
  };
}
