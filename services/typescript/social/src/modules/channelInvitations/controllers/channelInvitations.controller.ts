import type { Handler } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import { clampPageSize } from "../../../utils/cursor.util.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { CreateChannelInvitationLinkCommand } from "../commands/createChannelInvitationLink/createChannelInvitationLink.command.js";
import type { PreviewChannelInvitationLinkCommand } from "../commands/previewChannelInvitationLink/previewChannelInvitationLink.command.js";
import type { ClaimChannelInvitationLinkCommand } from "../commands/claimChannelInvitationLink/claimChannelInvitationLink.command.js";
import type { AcceptChannelInvitationCommand } from "../commands/acceptChannelInvitation/acceptChannelInvitation.command.js";
import type { DeclineChannelInvitationCommand } from "../commands/declineChannelInvitation/declineChannelInvitation.command.js";
import type { RevokeChannelInvitationLinkCommand } from "../commands/revokeChannelInvitationLink/revokeChannelInvitationLink.command.js";
import type { ListChannelInvitationLinksQuery } from "../queries/listChannelInvitationLinks/listChannelInvitationLinks.query.js";
import type { ListChannelInvitationsQuery } from "../queries/listChannelInvitations/listChannelInvitations.query.js";
import type { ChannelInvitationLinkCreatedView, ChannelInvitationLinkManagementView, ChannelInvitationLinkPreviewView, ChannelInvitationView } from "../models/channelInvitation.model.js";
import { channelIdParamsSchema, channelInvitationIdParamsSchema, channelInvitationLinkParamsSchema, channelInvitationLinksQuerySchema, channelInvitationTokenParamsSchema, channelInvitationsQuerySchema, createChannelInvitationLinkBodySchema } from "../validators/channelInvitation.validator.js";

export interface ChannelInvitationsHandlers {
  readonly createLink: Handler<CreateChannelInvitationLinkCommand, ChannelInvitationLinkCreatedView>;
  readonly previewLink: Handler<PreviewChannelInvitationLinkCommand, ChannelInvitationLinkPreviewView>;
  readonly claimLink: Handler<ClaimChannelInvitationLinkCommand, ChannelInvitationView>;
  readonly accept: Handler<AcceptChannelInvitationCommand, ChannelInvitationView>;
  readonly decline: Handler<DeclineChannelInvitationCommand, ChannelInvitationView>;
  readonly revokeLink: Handler<RevokeChannelInvitationLinkCommand, ChannelInvitationLinkManagementView>;
  readonly listLinks: Handler<ListChannelInvitationLinksQuery, Page<ChannelInvitationLinkManagementView>>;
  readonly listInvitations: Handler<ListChannelInvitationsQuery, Page<ChannelInvitationView>>;
}

export function createChannelInvitationsController(route: RouteFactory, handlers: ChannelInvitationsHandlers) {
  return {
    createLink: route({ authentication: "required", params: channelIdParamsSchema, body: createChannelInvitationLinkBodySchema, successStatus: 201, idempotent: true }, ({ principal, params, body }) =>
      handlers.createLink({ actorId: principal.accountId, channelId: params.channelId, expiresInHours: body.expiresInHours ?? 168 })),
    previewLink: route({ authentication: "required", params: channelInvitationTokenParamsSchema }, ({ params }) =>
      handlers.previewLink({ token: params.token })),
    claimLink: route({ authentication: "required", params: channelInvitationTokenParamsSchema, successStatus: 201, idempotent: true }, ({ principal, params }) =>
      handlers.claimLink({ inviteeId: principal.accountId, token: params.token })),
    accept: route({ authentication: "required", params: channelInvitationIdParamsSchema, idempotent: true }, ({ principal, params }) =>
      handlers.accept({ inviteeId: principal.accountId, invitationId: params.invitationId })),
    decline: route({ authentication: "required", params: channelInvitationIdParamsSchema, idempotent: true }, ({ principal, params }) =>
      handlers.decline({ inviteeId: principal.accountId, invitationId: params.invitationId })),
    revokeLink: route({ authentication: "required", params: channelInvitationLinkParamsSchema, idempotent: true }, ({ principal, params }) =>
      handlers.revokeLink({ actorId: principal.accountId, channelId: params.channelId, linkId: params.linkId })),
    listLinks: route({ authentication: "required", params: channelIdParamsSchema, query: channelInvitationLinksQuerySchema }, ({ principal, params, query }) =>
      handlers.listLinks({ actorId: principal.accountId, channelId: params.channelId, cursor: query.cursor, limit: clampPageSize(query.limit) })),
    listInvitations: route({ authentication: "required", query: channelInvitationsQuerySchema }, ({ principal, query }) =>
      handlers.listInvitations({ inviteeId: principal.accountId, status: query.status ?? "pending", cursor: query.cursor, limit: clampPageSize(query.limit) })),
  };
}
