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
import { createGroupInvitationsController } from "../groupInvitations/controllers/groupInvitations.controller.js";
import { createGroupInvitationHandler } from "../groupInvitations/commands/createGroupInvitation/createGroupInvitation.handler.js";
import { createListGroupInvitationsHandler } from "../groupInvitations/queries/listGroupInvitations/listGroupInvitations.handler.js";
import { createRespondGroupInvitationHandler } from "../groupInvitations/commands/respondGroupInvitation/respondGroupInvitation.handler.js";
import { createRevokeGroupInvitationHandler } from "../groupInvitations/commands/revokeGroupInvitation/revokeGroupInvitation.handler.js";
import { registerGroupInvitationsRoutes } from "../groupInvitations/routes/groupInvitations.routes.js";
import { createGroupInvitationLinkHandler } from "../groupInvitations/commands/createGroupInvitationLink/createGroupInvitationLink.handler.js";
import { claimGroupInvitationLinkHandler } from "../groupInvitations/commands/claimGroupInvitationLink/claimGroupInvitationLink.handler.js";
import { previewGroupInvitationLinkHandler } from "../groupInvitations/commands/previewGroupInvitationLink/previewGroupInvitationLink.handler.js";
import { revokeGroupInvitationLinkHandler } from "../groupInvitations/commands/revokeGroupInvitationLink/revokeGroupInvitationLink.handler.js";
import { listGroupInvitationLinksHandler } from "../groupInvitations/queries/listGroupInvitationLinks/listGroupInvitationLinks.handler.js";
import { createChannelInvitationLinkHandler } from "../channelInvitations/commands/createChannelInvitationLink/createChannelInvitationLink.handler.js";
import { previewChannelInvitationLinkHandler } from "../channelInvitations/commands/previewChannelInvitationLink/previewChannelInvitationLink.handler.js";
import { claimChannelInvitationLinkHandler } from "../channelInvitations/commands/claimChannelInvitationLink/claimChannelInvitationLink.handler.js";
import { acceptChannelInvitationHandler } from "../channelInvitations/commands/acceptChannelInvitation/acceptChannelInvitation.handler.js";
import { declineChannelInvitationHandler } from "../channelInvitations/commands/declineChannelInvitation/declineChannelInvitation.handler.js";
import { revokeChannelInvitationLinkHandler } from "../channelInvitations/commands/revokeChannelInvitationLink/revokeChannelInvitationLink.handler.js";
import { listChannelInvitationLinksHandler } from "../channelInvitations/queries/listChannelInvitationLinks/listChannelInvitationLinks.handler.js";
import { listChannelInvitationsHandler } from "../channelInvitations/queries/listChannelInvitations/listChannelInvitations.handler.js";
import { createChannelInvitationsController } from "../channelInvitations/controllers/channelInvitations.controller.js";
import { registerChannelInvitationsRoutes } from "../channelInvitations/routes/channelInvitations.routes.js";

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
  registerGroupInvitationsRoutes(router, createGroupInvitationsController(route, {
    create: createGroupInvitationHandler(context),
    list: createListGroupInvitationsHandler(context),
    respond: createRespondGroupInvitationHandler(context),
    revoke: createRevokeGroupInvitationHandler(context),
    createLink: createGroupInvitationLinkHandler(context),
    previewLink: previewGroupInvitationLinkHandler(context),
    claimLink: claimGroupInvitationLinkHandler(context),
    revokeLink: revokeGroupInvitationLinkHandler(context),
    listLinks: listGroupInvitationLinksHandler(context),
  }));
  registerChannelInvitationsRoutes(router, createChannelInvitationsController(route, {
    createLink: createChannelInvitationLinkHandler(context),
    previewLink: previewChannelInvitationLinkHandler(context),
    claimLink: claimChannelInvitationLinkHandler(context),
    accept: acceptChannelInvitationHandler(context),
    decline: declineChannelInvitationHandler(context),
    revokeLink: revokeChannelInvitationLinkHandler(context),
    listLinks: listChannelInvitationLinksHandler(context),
    listInvitations: listChannelInvitationsHandler(context),
  }));
}
