import { defineEvent } from "@zudojs/events";

import type { FollowTargetType } from "../models/follows.model.js";

export interface UnfollowedPayload {
  readonly followerId: string;
  readonly targetType: FollowTargetType;
  readonly targetId: string;
}

export const UnfollowedEvent = defineEvent<"follows.unfollowed", UnfollowedPayload>("follows.unfollowed");
