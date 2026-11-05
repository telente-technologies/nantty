import { notFound, SocialError } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";

export async function assertStoreFollowable(context: HandlerContext, storeId: string, viewerId: string): Promise<void> {
  if (context.shareCards === undefined) throw new SocialError(503, "STORE_LOOKUP_UNAVAILABLE", "Following stores is temporarily unavailable. Try again shortly.");
  const card = await context.shareCards.resolve("store", storeId, viewerId).catch(() => null);
  if (card === null) throw new SocialError(503, "STORE_LOOKUP_UNAVAILABLE", "Following stores is temporarily unavailable. Try again shortly.");
  if (card.availability === "unavailable" || card.availability === "private") throw notFound("STORE_NOT_FOUND", "Store not found.");
}
