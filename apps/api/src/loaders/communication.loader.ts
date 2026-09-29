import { NotificationRequestedEvent } from "../events/notificationRequested.event.js";
import type { AuditRecorder } from "../interfaces/audit.interface.js";
import type { SocialGraph } from "../interfaces/socialGraph.interface.js";
import type { UserDirectory } from "../interfaces/userDirectory.interface.js";
import { UserRegisteredEvent } from "../modules/auth/events/userRegistered.event.js";
import { MessagesController } from "../modules/messages/controllers/messages.controller.js";
import { registerMessagesCommandAndQueryHandlers } from "../modules/messages/messages.module.js";
import { PrismaMessagesRepository } from "../modules/messages/repositories/messages.prisma.repository.js";
import { InMemoryMessagesRepository } from "../modules/messages/repositories/messages.repository.js";
import { MessagesService } from "../modules/messages/services/messages.service.js";
import { EmailChannel, IntegrationNotificationEmailSender, type NotificationEmailSender } from "../modules/notifications/channels/email.channel.js";
import { InAppChannel } from "../modules/notifications/channels/inApp.channel.js";
import { PushChannel, UnconfiguredPushSender, type PushSender } from "../modules/notifications/channels/push.channel.js";
import { SendNotificationCommand } from "../modules/notifications/commands/sendNotification/sendNotification.command.js";
import { NotificationsController } from "../modules/notifications/controllers/notifications.controller.js";
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

export interface CommunicationExternalServices {
  readonly pushSender?: PushSender;
  readonly notificationEmailSender?: NotificationEmailSender;
}

export interface CommunicationSharedServices {
  readonly audit: AuditRecorder;
  readonly userDirectory: UserDirectory;
  readonly socialGraph: SocialGraph;
}

function createNotificationsModule(core: Core, shared: CommunicationSharedServices, external: CommunicationExternalServices): NotificationsService {
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
    await core.commands.execute(new SendNotificationCommand(request));
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
  createNotificationsModule(core, shared, external);
  const usePrisma = core.persistence === "prisma";
  const messagesService = new MessagesService({
    messages: usePrisma ? new PrismaMessagesRepository() : new InMemoryMessagesRepository(),
    userDirectory: shared.userDirectory,
    socialGraph: shared.socialGraph,
    events: core.events,
    clock: core.clock,
  });
  registerMessagesCommandAndQueryHandlers(core.commands, core.queries, messagesService);
  const waitlistService = new WaitlistService({
    entries: usePrisma ? new PrismaWaitlistRepository() : new InMemoryWaitlistRepository(),
    events: core.events,
    clock: core.clock,
  });
  registerWaitlistCommandAndQueryHandlers(core.commands, core.queries, waitlistService);
  return {
    controllers: {
      notificationsController: new NotificationsController(core.commands, core.queries),
      messagesController: new MessagesController(core.commands, core.queries),
      waitlistController: new WaitlistController(core.commands, core.queries),
    },
  };
}
