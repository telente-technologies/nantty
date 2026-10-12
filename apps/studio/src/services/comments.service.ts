import type { ID, Page } from "@/types";
import type { CommentHiddenState, MyPostComment, MyPostCommentsFilter, PostComment } from "@/types/studioSocial.type";

import { createIdempotencyKey, sendRequestToStudioServer } from "./clientApi.service";

const id = (value: ID) => encodeURIComponent(value);

export interface MyPostCommentsQuery {
  readonly filter: MyPostCommentsFilter;
  readonly postId?: ID;
  readonly search?: string;
  readonly cursor?: string;
}

export const commentsService = {
  listMyPostComments: ({ filter, postId, search, cursor }: MyPostCommentsQuery, limit = 20) =>
    sendRequestToStudioServer<Page<MyPostComment>>("/api/v1/me/post-comments", { query: { filter, postId: postId || undefined, q: search || undefined, cursor, limit } }),
  reply: (postId: ID, parentCommentId: ID, text: string) =>
    sendRequestToStudioServer<PostComment>(`/api/v1/posts/${id(postId)}/comments`, { method: "POST", body: { text, parentCommentId }, idempotencyKey: createIdempotencyKey("reply") }),
  deleteComment: (commentId: ID) => sendRequestToStudioServer<void>(`/api/v1/comments/${id(commentId)}`, { method: "DELETE" }),
  pinComment: (postId: ID, commentId: ID) => sendRequestToStudioServer<PostComment>(`/api/v1/posts/${id(postId)}/comments/${id(commentId)}/pin`, { method: "PUT" }),
  unpinComment: (postId: ID, commentId: ID) => sendRequestToStudioServer<void>(`/api/v1/posts/${id(postId)}/comments/${id(commentId)}/pin`, { method: "DELETE" }),
  hideComment: (postId: ID, commentId: ID) => sendRequestToStudioServer<CommentHiddenState>(`/api/v1/posts/${id(postId)}/comments/${id(commentId)}/hide`, { method: "PUT" }),
  unhideComment: (postId: ID, commentId: ID) => sendRequestToStudioServer<CommentHiddenState>(`/api/v1/posts/${id(postId)}/comments/${id(commentId)}/hide`, { method: "DELETE" }),
};
