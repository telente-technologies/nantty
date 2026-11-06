import type { ChannelInvitation } from "../../../generated/prisma/client.js";
import type { ChannelInvitationView } from "../models/channelInvitation.model.js";

type InvitationWithConversation = ChannelInvitation & { readonly conversation: { readonly id: string; readonly title: string | null } };

export function toChannelInvitationView(row: InvitationWithConversation): ChannelInvitationView {
  return {
    id: row.id,
    channelId: row.conversationId,
    channelTitle: row.conversation.title,
    inviterId: row.inviterId,
    inviteeId: row.inviteeId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}
