import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { GroupMembershipInvitation } from "../../../generated/prisma/client.js";
import type { GroupInvitationView } from "../models/groupInvitation.model.js";

export async function toGroupInvitationViews(context: HandlerContext, rows: readonly GroupMembershipInvitation[], viewerId: string): Promise<GroupInvitationView[]> {
  const counterpartIds = [...new Set(rows.map((row) => row.inviterId === viewerId ? row.inviteeId : row.inviterId))];
  const summaries = counterpartIds.length === 0 ? new Map() : await context.directory.findUserSummaries(counterpartIds);
  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversationId,
    inviterId: row.inviterId,
    inviteeId: row.inviteeId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    counterpart: summaries.get(row.inviterId === viewerId ? row.inviteeId : row.inviterId) ?? null,
    membershipStatus: row.status === "accepted" ? "awaiting_secure_key_handoff" : "not_joined",
  }));
}
