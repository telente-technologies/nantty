import { defineEvent } from "@zudojs/events";

export interface PostCommentedPayload {
  readonly postId: string;
  readonly commentId: string;
  readonly authorId: string;
}

export const PostCommentedEvent = defineEvent<"posts.postCommented", PostCommentedPayload>("posts.postCommented");
