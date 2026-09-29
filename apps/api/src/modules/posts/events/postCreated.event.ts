import { defineEvent } from "@zudojs/events";

import type { PostKind } from "../models/posts.model.js";

export interface PostCreatedPayload {
  readonly postId: string;
  readonly authorId: string;
  readonly kind: PostKind;
}

export const PostCreatedEvent = defineEvent<"posts.postCreated", PostCreatedPayload>("posts.postCreated");
