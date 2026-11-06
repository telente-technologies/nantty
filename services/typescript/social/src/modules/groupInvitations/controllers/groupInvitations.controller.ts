import type { Handler } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import { clampPageSize } from "../../../utils/cursor.util.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { CreateGroupInvitationCommand } from "../commands/createGroupInvitation/createGroupInvitation.command.js";
import type { RespondGroupInvitationCommand } from "../commands/respondGroupInvitation/respondGroupInvitation.command.js";
import type { RevokeGroupInvitationCommand } from "../commands/revokeGroupInvitation/revokeGroupInvitation.command.js";
import type { CreateGroupInvitationLinkCommand } from "../commands/createGroupInvitationLink/createGroupInvitationLink.command.js";
import type { ClaimGroupInvitationLinkCommand } from "../commands/claimGroupInvitationLink/claimGroupInvitationLink.command.js";
import type { PreviewGroupInvitationLinkCommand } from "../commands/previewGroupInvitationLink/previewGroupInvitationLink.command.js";
import type { RevokeGroupInvitationLinkCommand } from "../commands/revokeGroupInvitationLink/revokeGroupInvitationLink.command.js";
import type { ListGroupInvitationLinksQuery } from "../queries/listGroupInvitationLinks/listGroupInvitationLinks.query.js";
import type { GroupInvitationLinkCreatedView, GroupInvitationLinkManagementView, GroupInvitationLinkPreviewView, GroupInvitationLinkRevokedView } from "../models/groupInvitationLink.model.js";
import type { GroupInvitationView } from "../models/groupInvitation.model.js";
import type { ListGroupInvitationsQuery } from "../queries/listGroupInvitations/listGroupInvitations.query.js";
import { claimGroupInvitationLinkParamsSchema, conversationInvitationLinkParamsSchema, conversationInvitationParamsSchema, conversationParamsSchema, createGroupInvitationBodySchema, createGroupInvitationLinkBodySchema, groupInvitationLinkTokenParamsSchema, invitationParamsSchema, listGroupInvitationLinksParamsSchema, listGroupInvitationLinksQuerySchema, listGroupInvitationsQuerySchema } from "../validators/groupInvitation.validator.js";

export interface GroupInvitationHandlers {
  readonly create: Handler<CreateGroupInvitationCommand, GroupInvitationView>;
  readonly list: Handler<ListGroupInvitationsQuery, Page<GroupInvitationView>>;
  readonly respond: Handler<RespondGroupInvitationCommand, GroupInvitationView>;
  readonly revoke: Handler<RevokeGroupInvitationCommand, GroupInvitationView>;
  readonly createLink: Handler<CreateGroupInvitationLinkCommand, GroupInvitationLinkCreatedView>;
  readonly previewLink: Handler<PreviewGroupInvitationLinkCommand, GroupInvitationLinkPreviewView>;
  readonly claimLink: Handler<ClaimGroupInvitationLinkCommand, GroupInvitationView>;
  readonly revokeLink: Handler<RevokeGroupInvitationLinkCommand, GroupInvitationLinkRevokedView>;
  readonly listLinks: Handler<ListGroupInvitationLinksQuery, Page<GroupInvitationLinkManagementView>>;
}

export function createGroupInvitationsController(route: RouteFactory, handlers: GroupInvitationHandlers) {
  return {
    create: route({ authentication: "required", params: conversationParamsSchema, body: createGroupInvitationBodySchema, successStatus: 201, idempotent: true }, ({ principal, params, body }) =>
      handlers.create({ actorId: principal.accountId, conversationId: params.conversationId, inviteeId: body.inviteeId })),
    list: route({ authentication: "required", query: listGroupInvitationsQuerySchema }, ({ principal, query }) =>
      handlers.list({ accountId: principal.accountId, direction: query.direction ?? "received", status: query.status ?? "pending", cursor: query.cursor, limit: clampPageSize(query.limit) })),
    accept: route({ authentication: "required", params: invitationParamsSchema, idempotent: true }, ({ principal, params }) =>
      handlers.respond({ accountId: principal.accountId, invitationId: params.invitationId, decision: "accept" })),
    decline: route({ authentication: "required", params: invitationParamsSchema, idempotent: true }, ({ principal, params }) =>
      handlers.respond({ accountId: principal.accountId, invitationId: params.invitationId, decision: "decline" })),
    revoke: route({ authentication: "required", params: conversationInvitationParamsSchema, idempotent: true }, ({ principal, params }) =>
      handlers.revoke({ actorId: principal.accountId, conversationId: params.conversationId, invitationId: params.invitationId })),
    createLink: route({ authentication: "required", params: conversationParamsSchema, body: createGroupInvitationLinkBodySchema, successStatus: 201, idempotent: true }, ({ principal, params, body }) =>
      handlers.createLink({ actorId: principal.accountId, conversationId: params.conversationId, expiresInHours: body.expiresInHours ?? 168 })),
    previewLink: route({ authentication: "required", params: groupInvitationLinkTokenParamsSchema }, ({ params }) =>
      handlers.previewLink({ token: params.token })),
    claimLink: route({ authentication: "required", params: claimGroupInvitationLinkParamsSchema, successStatus: 201, idempotent: true }, ({ principal, params }) =>
      handlers.claimLink({ inviteeId: principal.accountId, token: params.token })),
    revokeLink: route({ authentication: "required", params: conversationInvitationLinkParamsSchema, idempotent: true }, ({ principal, params }) =>
      handlers.revokeLink({ actorId: principal.accountId, conversationId: params.conversationId, linkId: params.linkId })),
    listLinks: route({ authentication: "required", params: listGroupInvitationLinksParamsSchema, query: listGroupInvitationLinksQuerySchema }, ({ principal, params, query }) =>
      handlers.listLinks({ actorId: principal.accountId, conversationId: params.conversationId, cursor: query.cursor, limit: clampPageSize(query.limit) })),
  };
}
