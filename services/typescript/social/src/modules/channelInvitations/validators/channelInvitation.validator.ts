import { schema } from "@nantty/fastify-platform";

export const channelIdParamsSchema = schema.object({ channelId: schema.string().uuid() });
export const channelInvitationLinkParamsSchema = schema.object({ channelId: schema.string().uuid(), linkId: schema.string().uuid() });
export const channelInvitationIdParamsSchema = schema.object({ invitationId: schema.string().uuid() });
export const channelInvitationTokenParamsSchema = schema.object({ token: schema.string().min(43).max(43).regex(/^[A-Za-z0-9_-]{43}$/) });
export const createChannelInvitationLinkBodySchema = schema.object({ expiresInHours: schema.union([schema.literal(24), schema.literal(168), schema.literal(720)]).optional() });
export const channelInvitationLinksQuerySchema = schema.object({ cursor: schema.string().uuid().optional(), limit: schema.coerce.number().int().min(1).max(100).optional() });
export const channelInvitationsQuerySchema = schema.object({ status: schema.enum(["pending", "accepted", "declined", "expired"]).optional(), cursor: schema.string().uuid().optional(), limit: schema.coerce.number().int().min(1).max(100).optional() });
