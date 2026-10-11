import type { ConversationFilter } from "../../models/comment.model.js";

export interface ListPostCommentsQuery {
  readonly viewerId: string | undefined;
  readonly postId: string;
  readonly filter?: ConversationFilter;
  readonly cursor: string | undefined;
  readonly limit: number;
}
