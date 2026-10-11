import { notFound, SocialError } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { ConversationRow } from "../../conversations/repositories/conversation.repository.js";
import { resolveEncryptionRecipients } from "../../conversations/services/encryptionRecipients.service.js";

export const isStoreConversation = (conversation: Pick<ConversationRow, "kind" | "storeId">): conversation is Pick<ConversationRow, "kind"> & { readonly storeId: string } =>
  conversation.kind === "business" && conversation.storeId !== null;

export async function storeTeamAudience(context: HandlerContext, conversation: ConversationRow): Promise<string[]> {
  if (!isStoreConversation(conversation)) return [];
  try {
    return [...(await resolveEncryptionRecipients(context, conversation)).storeTeamUserIds];
  } catch {
    return [];
  }
}

export async function storeTeamMemberSummary(context: HandlerContext, conversation: ConversationRow, accountId: string): Promise<{ readonly name: string; readonly username: string; readonly avatarUrl: string | null; readonly verified: boolean } | null> {
  if (!isStoreConversation(conversation) || accountId === conversation.storeId) return null;
  if (!(await storeTeamAudience(context, conversation)).includes(accountId)) return null;
  const card = await context.shareCards?.resolve("store", conversation.storeId, accountId).catch(() => null);
  return { name: card?.title ?? "Store", username: "", avatarUrl: card?.imageUrl ?? null, verified: false };
}

export async function assertStoreCanBeMessaged(context: HandlerContext, storeId: string, buyerId: string): Promise<void> {
  if (context.shareCards === undefined) return;
  const card = await context.shareCards.resolve("store", storeId, buyerId).catch(() => null);
  if (card === null) throw new SocialError(503, "STORE_LOOKUP_UNAVAILABLE", "Messaging this store is temporarily unavailable. Try again shortly.");
  if (card.availability !== "available") throw notFound("STORE_NOT_FOUND", "Store not found.");
}
