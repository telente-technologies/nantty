import { defineEvent } from "@zudojs/events";

import type { FollowTargetType } from "../models/follows.model.js";

export interface FollowedPayload {
  readonly followerId: string;
  readonly targetType: FollowTargetType;
  readonly targetId: string;
}

export const FollowedEvent = defineEvent<"follows.followed", FollowedPayload>("follows.followed");
