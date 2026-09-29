import { useWebSocketConnectionHandler } from "../integrations/websockets.integration.js";
import type { MediaLibrary } from "../interfaces/mediaLibrary.interface.js";
import type { AccessTokenVerifier } from "../interfaces/principal.interface.js";
import type { SocialGraph } from "../interfaces/socialGraph.interface.js";
import type { StoreAccess } from "../interfaces/storeAccess.interface.js";
import type { UserDirectory } from "../interfaces/userDirectory.interface.js";
import { GroupChatsController } from "../modules/messages/controllers/groupChats.controller.js";
import { MessagesController } from "../modules/messages/controllers/messages.controller.js";
import { RealtimeHub } from "../modules/messages/gateways/realtimeHub.gateway.js";
import { WebSocketBridge } from "../modules/messages/gateways/webSocketBridge.gateway.js";
import { createDisappearingMessagesPurgeJob, createRealtimeTicketCleanupJob } from "../modules/messages/jobs/messageMaintenance.job.js";
import { registerMessagesCommandAndQueryHandlers } from "../modules/messages/messages.module.js";
import { PrismaConversationsRepository } from "../modules/messages/repositories/conversations.prisma.repository.js";
import { InMemoryConversationsRepository } from "../modules/messages/repositories/conversations.repository.js";
import { PrismaMessagesRepository } from "../modules/messages/repositories/messages.prisma.repository.js";
import { InMemoryMessagesRepository } from "../modules/messages/repositories/messages.repository.js";
import { InMemoryRealtimeTicketsRepository, PrismaRealtimeTicketsRepository } from "../modules/messages/repositories/realtimeTickets.repository.js";
import { MessageModerationTarget } from "../modules/messages/services/messageModerationTarget.service.js";
import { MessagesService } from "../modules/messages/services/messages.service.js";
import { RealtimeTicketService } from "../modules/messages/services/realtimeTickets.service.js";
import type { Core } from "./core.loader.js";

export interface MessagingSharedServices {
  readonly userDirectory: UserDirectory;
  readonly socialGraph: SocialGraph;
  readonly storeAccess: StoreAccess;
  readonly mediaLibrary: MediaLibrary;
  readonly accessTokenVerifier: AccessTokenVerifier;
}

const AUTHENTICATION_TIMEOUT_SECONDS = 10;
const MAXIMUM_CLIENT_MESSAGES_PER_MINUTE = 120;
const MAXIMUM_CLIENT_MESSAGE_BYTES = 16 * 1024;

export function createMessagingModule(core: Core, shared: MessagingSharedServices) {
  const usePrisma = core.persistence === "prisma";
  const settings = core.settings.communication;
  const realtimeTickets = new RealtimeTicketService(
    usePrisma ? new PrismaRealtimeTicketsRepository() : new InMemoryRealtimeTicketsRepository(),
    core.clock,
    settings.realtimeTicketTtlSeconds,
  );
  let messagesService: MessagesService | undefined;
  const realtimeHub = new RealtimeHub(
    {
      authenticateWithAccessToken: (accessToken) => shared.accessTokenVerifier.verify(accessToken),
      authenticateWithTicket: (ticket) => realtimeTickets.redeemTicket(ticket),
    },
    {
      handleTypingSignal: async (principal, conversationId, isTyping) => {
        await messagesService?.broadcaster.relayTypingSignal(conversationId, principal.userId, isTyping);
      },
    },
    core.clock,
    core.logger,
    {
      maximumConnectionsPerUser: settings.realtimeMaxConnectionsPerUser,
      maximumBufferedBytes: settings.realtimeMaxBufferedBytes,
      heartbeatSeconds: settings.realtimeHeartbeatSeconds,
      authenticationTimeoutSeconds: AUTHENTICATION_TIMEOUT_SECONDS,
      maximumClientMessagesPerMinute: MAXIMUM_CLIENT_MESSAGES_PER_MINUTE,
      maximumClientMessageBytes: MAXIMUM_CLIENT_MESSAGE_BYTES,
    },
  );
  messagesService = new MessagesService({
    conversations: usePrisma ? new PrismaConversationsRepository() : new InMemoryConversationsRepository(),
    messages: usePrisma ? new PrismaMessagesRepository() : new InMemoryMessagesRepository(),
    userDirectory: shared.userDirectory,
    socialGraph: shared.socialGraph,
    storeAccess: shared.storeAccess,
    mediaLibrary: shared.mediaLibrary,
    realtime: realtimeHub,
    events: core.events,
    clock: core.clock,
    settings: { publicBaseUrl: core.settings.media.publicBaseUrl, maximumGroupMembers: settings.maximumGroupMembers },
  });
  registerMessagesCommandAndQueryHandlers(core.commands, core.queries, messagesService, realtimeTickets);
  if (usePrisma) useWebSocketConnectionHandler(new WebSocketBridge(realtimeHub, settings.realtimeHeartbeatSeconds));
  return {
    realtimeHub,
    messagesService,
    messageModerationTarget: new MessageModerationTarget(messagesService),
    scheduledJobs: [createDisappearingMessagesPurgeJob(messagesService), createRealtimeTicketCleanupJob(realtimeTickets)],
    controllers: {
      messagesController: new MessagesController(core.commands, core.queries),
      groupChatsController: new GroupChatsController(core.commands, core.queries),
    },
  };
}
