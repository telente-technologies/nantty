import { readErrorMessageForDisplay, StudioRequestError } from "@/services/clientApi.service";

const LIVE_STORE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  PRODUCTS_REQUIRE_STORE: "Products can only be shown on a live started for one of your stores.",
  SHOPPING_REQUIRES_STORE: "Only accounts with a store can host a shopping live.",
  NOT_STORE_MEMBER: "You're no longer a member of this store, so you can't stream or pin for it.",
  PRODUCT_NOT_IN_STORE: "That product doesn't belong to this live's store.",
  PRODUCT_NOT_PUBLISHED: "Publish this product in your store before showing it on stream.",
  CATALOG_UNAVAILABLE: "We couldn't check your store right now. Try again in a moment.",
  SCHEDULE_IN_PAST: "That time has already passed. Pick a time in the future.",
  SCHEDULE_TOO_FAR: "You can schedule a live up to 90 days ahead.",
  LIVE_NOT_EDITABLE: "This live has already started or ended, so it can't be changed.",
  NOT_LIVE_HOST: "Only the creator hosting this live can do that.",
  LIVE_ALREADY_RUNNING: "You're already live. End that live before starting another.",
  RECORDING_IN_PROGRESS: "This recording is still being saved. Try again once the live has ended.",
  MODERATOR_SELF: "You already control your own lives, so you can't add yourself as a moderator.",
  BLOCKED_WORD_INVALID: "Blocked words must be 2-30 characters, or a single emoji.",
  RECORDING_NOT_FOUND: "That recording was already deleted.",
  RECORDING_UNAVAILABLE: "We couldn't delete the recording file just now. Try again in a moment.",
  MODERATOR_LIMIT: "You can have up to 20 default moderators.",
  USER_NOT_FOUND: "One of those moderators no longer has an account.",
  BLOCKED_WORDS_LIMIT: "You can block up to 100 words.",
  INGRESS_UNAVAILABLE: "The live server isn't responding right now. Try again in a moment.",
};

export function readLiveErrorMessage(error: unknown): string {
  const message = error instanceof StudioRequestError ? LIVE_STORE_ERROR_MESSAGES[error.code] : undefined;
  return message ?? readErrorMessageForDisplay(error);
}
