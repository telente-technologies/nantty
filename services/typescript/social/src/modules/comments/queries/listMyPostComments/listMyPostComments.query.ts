import type { MyPostCommentsFilter } from "../../models/myPostComments.model.js";

export interface ListMyPostCommentsQuery {
  readonly ownerId: string;
  readonly filter: MyPostCommentsFilter;
  readonly postId: string | undefined;
  readonly search: string | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}
