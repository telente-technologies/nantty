import { SocialError } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { ConversationRow } from "../repositories/conversation.repository.js";

export interface EncryptionRecipients {
  readonly userIds: readonly string[];
  readonly storeTeamUserIds: readonly string[];
}

export async function resolveEncryptionRecipients(context: HandlerContext, conversation: ConversationRow): Promise<EncryptionRecipients> {
  const active = conversation.members.filter((member) => member.leftAt === null).map((member) => member.accountId);
  if (conversation.kind !== "business" || conversation.storeId === null) return { userIds: [...new Set(active)], storeTeamUserIds: [] };
  if (context.storeInboxTeam === undefined) throw new SocialError(503, "STORE_TEAM_UNAVAILABLE", "Secure store chat is temporarily unavailable. Try again shortly.");
  const storeId = conversation.storeId;
  const team = (await context.storeInboxTeam.memberAccountIds(storeId)).filter((accountId) => accountId !== storeId);
  const people = active.filter((accountId) => accountId !== storeId);
  return { userIds: [...new Set([...people, ...team])], storeTeamUserIds: [...new Set(team)] };
}
