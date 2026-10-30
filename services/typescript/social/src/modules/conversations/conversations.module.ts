import type { HttpRouter } from "@nantty/fastify-platform";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createAcceptMessageRequestHandler } from "./commands/acceptMessageRequest/acceptMessageRequest.handler.js";
import { createAddGroupMembersHandler } from "./commands/addGroupMembers/addGroupMembers.handler.js";
import { createBlockConversationPeerHandler } from "./commands/blockConversationPeer/blockConversationPeer.handler.js";
import { createCreateGroupConversationHandler } from "./commands/createGroupConversation/createGroupConversation.handler.js";
import { createDeleteConversationHandler } from "./commands/deleteConversation/deleteConversation.handler.js";
import { createLeaveConversationHandler } from "./commands/leaveConversation/leaveConversation.handler.js";
import { createMarkConversationNotSpamHandler } from "./commands/markConversationNotSpam/markConversationNotSpam.handler.js";
import { createMarkConversationReadHandler } from "./commands/markConversationRead/markConversationRead.handler.js";
import { createMuteConversationHandler } from "./commands/muteConversation/muteConversation.handler.js";
import { createRemoveGroupMemberHandler } from "./commands/removeGroupMember/removeGroupMember.handler.js";
import { createRestrictConversationHandler } from "./commands/restrictConversation/restrictConversation.handler.js";
import { createSetGroupAdminHandler } from "./commands/setGroupAdmin/setGroupAdmin.handler.js";
import { createStartDirectConversationHandler } from "./commands/startDirectConversation/startDirectConversation.handler.js";
import { createUpdateConversationHandler } from "./commands/updateConversation/updateConversation.handler.js";
import { createConversationsController } from "./controllers/conversations.controller.js";
import { createGetConversationHandler } from "./queries/getConversation/getConversation.handler.js";
import { createGetEncryptionRecipientsHandler } from "./queries/getEncryptionRecipients/getEncryptionRecipients.handler.js";
import { createListConversationMembersHandler } from "./queries/listConversationMembers/listConversationMembers.handler.js";
import { createListConversationsHandler } from "./queries/listConversations/listConversations.handler.js";
import { createSearchConversationsHandler } from "./queries/searchConversations/searchConversations.handler.js";
import { registerConversationsRoutes } from "./routes/conversations.routes.js";
import { createCreateChannelHandler } from "./commands/createChannel/createChannel.handler.js";
import { createSubscribeToChannelHandler } from "./commands/subscribeToChannel/subscribeToChannel.handler.js";
import { createUnsubscribeFromChannelHandler } from "./commands/unsubscribeFromChannel/unsubscribeFromChannel.handler.js";
import { createChannelsController } from "./controllers/channels.controller.js";
import { registerChannelsRoutes } from "./routes/channels.routes.js";
import { createInternalMembershipController } from "./controllers/internalMembership.controller.js";
import { createGetInternalMembershipHandler } from "./queries/getInternalMembership/getInternalMembership.handler.js";

export function mountConversationsModule(router: HttpRouter, route: RouteFactory, context: HandlerContext, internalToken = ""): void {
  const internal = createInternalMembershipController(route, createGetInternalMembershipHandler(context), internalToken);
  router.get("/api/v1/internal/conversations/:conversationId/members/:accountId", internal.membership);
  registerConversationsRoutes(router, createConversationsController(route, {
    startDirectConversation: createStartDirectConversationHandler(context),
    createGroupConversation: createCreateGroupConversationHandler(context),
    acceptMessageRequest: createAcceptMessageRequestHandler(context),
    deleteConversation: createDeleteConversationHandler(context),
    blockConversationPeer: createBlockConversationPeerHandler(context),
    markConversationNotSpam: createMarkConversationNotSpamHandler(context),
    restrictConversation: createRestrictConversationHandler(context),
    muteConversation: createMuteConversationHandler(context),
    markConversationRead: createMarkConversationReadHandler(context),
    updateConversation: createUpdateConversationHandler(context),
    addGroupMembers: createAddGroupMembersHandler(context),
    removeGroupMember: createRemoveGroupMemberHandler(context),
    setGroupAdmin: createSetGroupAdminHandler(context),
    leaveConversation: createLeaveConversationHandler(context),
    listConversations: createListConversationsHandler(context),
    getConversation: createGetConversationHandler(context),
    listConversationMembers: createListConversationMembersHandler(context),
    getEncryptionRecipients: createGetEncryptionRecipientsHandler(context),
    searchConversations: createSearchConversationsHandler(context),
  }));
  registerChannelsRoutes(router, createChannelsController(route, {
    createChannel: createCreateChannelHandler(context),
    subscribeToChannel: createSubscribeToChannelHandler(context),
    unsubscribeFromChannel: createUnsubscribeFromChannelHandler(context),
  }));
}
