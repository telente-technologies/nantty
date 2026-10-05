import { notFound } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";

export async function assertStoreFollowable(context: HandlerContext, storeId: string, viewerId: string): Promise<void> {
  const card = await context.shareCards?.resolve("store", storeId, viewerId);
  if (card !== undefined && card !== null && card.availability === "unavailable") throw notFound("STORE_NOT_FOUND", "Store not found.");
}
