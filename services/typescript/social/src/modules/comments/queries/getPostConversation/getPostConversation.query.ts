import type { ConversationFilter } from "../../models/comment.model.js";

export interface GetPostConversationQuery {
  readonly viewerId: string | undefined;
  readonly postId: string;
  readonly sort: "relevant" | "latest" | "likes" | "top";
  readonly filter?: ConversationFilter;
  readonly cursor: string | undefined;
  readonly limit: number;
}
