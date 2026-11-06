import { schema } from "@nantty/fastify-platform";

export const invitationParamsSchema = schema.object({ invitationId: schema.string().uuid() });
export const conversationParamsSchema = schema.object({ conversationId: schema.string().uuid() });
export const conversationInvitationParamsSchema = schema.object({ conversationId: schema.string().uuid(), invitationId: schema.string().uuid() });
export const conversationInvitationLinkParamsSchema = schema.object({ conversationId: schema.string().uuid(), linkId: schema.string().uuid() });
export const listGroupInvitationLinksParamsSchema = conversationParamsSchema;
export const listGroupInvitationLinksQuerySchema = schema.object({ cursor: schema.string().uuid().optional(), limit: schema.coerce.number().int().min(1).max(100).optional() });
export const groupInvitationLinkTokenParamsSchema = schema.object({ token: schema.string().min(43).max(43).regex(/^[A-Za-z0-9_-]{43}$/) });
export const claimGroupInvitationLinkParamsSchema = groupInvitationLinkTokenParamsSchema;
export const createGroupInvitationBodySchema = schema.object({ inviteeId: schema.string().uuid() });
export const createGroupInvitationLinkBodySchema = schema.object({ expiresInHours: schema.union([schema.literal(24), schema.literal(168), schema.literal(720)]).optional() });
export const listGroupInvitationsQuerySchema = schema.object({
  direction: schema.enum(["received", "sent"]).optional(),
  status: schema.enum(["pending", "accepted"]).optional(),
  cursor: schema.string().uuid().optional(),
  limit: schema.coerce.number().int().min(1).max(100).optional(),
});
