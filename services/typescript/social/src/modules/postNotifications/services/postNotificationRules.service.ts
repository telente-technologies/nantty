import { conflict, forbidden, unprocessable } from "../../../errors/social.error.js";
import type { PostNotificationLevel, PostNotificationScope } from "../models/postNotifications.model.js";

export interface PostNotificationChangeInput {
  readonly isSelf: boolean;
  readonly blockedEitherWay: boolean;
  readonly followState: "requested" | "accepted" | "rejected" | undefined;
}

export function assertCanChangePostNotifications(input: PostNotificationChangeInput): void {
  if (input.isSelf) throw unprocessable("CANNOT_SUBSCRIBE_TO_SELF", "You can't turn on post notifications for yourself.");
  if (input.blockedEitherWay) throw forbidden("POST_NOTIFICATIONS_NOT_ALLOWED", "You can't get notifications from this account.");
  if (input.followState !== "accepted") throw conflict("NOT_FOLLOWING", "Follow this account to get post notifications.");
}

export function levelsForScope(scope: PostNotificationScope): readonly PostNotificationLevel[] {
  return scope === "lives" ? ["posts_and_lives"] : ["posts", "posts_and_lives"];
}

export function viewerLevelOf(followState: string | undefined, stored: PostNotificationLevel | undefined): PostNotificationLevel {
  return followState === "accepted" ? (stored ?? "off") : "off";
}
