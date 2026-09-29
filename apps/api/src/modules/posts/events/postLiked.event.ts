import { defineEvent } from "@zudojs/events";

export interface PostLikedPayload {
  readonly postId: string;
  readonly userId: string;
  readonly authorId: string;
}

export const PostLikedEvent = defineEvent<"posts.postLiked", PostLikedPayload>("posts.postLiked");
