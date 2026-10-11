import { ApiError } from "@/errors/api.error";

const LIVE_STORE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  PRODUCTS_REQUIRE_STORE: "Products can only be shown on a live started for your store.",
  SHOPPING_REQUIRES_STORE: "Only accounts with a store can host a shopping live.",
  NOT_STORE_MEMBER: "You're no longer a member of this store, so you can't go live or pin for it.",
  PRODUCT_NOT_IN_STORE: "That product doesn't belong to this live's store.",
  PRODUCT_NOT_PUBLISHED: "Publish this product in your store before showing it on your live.",
  CATALOG_UNAVAILABLE: "We couldn't check your store right now. Try again in a moment.",
  LIVE_ALREADY_RUNNING: "You're already live. Opening your live now.",
  LIVE_RESTRICTED: "Going live is paused on your account. See Settings > Account status.",
};

export function readLiveErrorMessage(error: unknown, fallback: string): string {
  const code = error instanceof ApiError ? error.code : undefined;
  return (code ? LIVE_STORE_ERROR_MESSAGES[code] : undefined) ?? fallback;
}

export function readRunningLiveId(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.code !== "LIVE_ALREADY_RUNNING") return null;
  const liveId = error.details?.liveId;
  return typeof liveId === "string" && liveId.length > 0 ? liveId : null;
}
