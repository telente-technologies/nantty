import type { ID, Page } from "@/types";
import type { PostCommentsItem, PostComment, PostCommentThread } from "@/types/studioSocial.type";

import { createIdempotencyKey, sendRequestToStudioServer } from "./clientApi.service";

const id = (value: ID) => encodeURIComponent(value);

const isThread = (item: PostCommentsItem): item is PostCommentThread => item.type === "comment";

export const commentsService = {
  listPostComments: async (postId: ID, limit = 20): Promise<PostCommentThread[]> =>
    (await sendRequestToStudioServer<Page<PostCommentsItem>>(`/api/v1/posts/${id(postId)}/comments`, { query: { filter: "all", limit } })).data.filter(isThread),
  reply: (postId: ID, parentCommentId: ID, text: string) =>
    sendRequestToStudioServer<PostComment>(`/api/v1/posts/${id(postId)}/comments`, { method: "POST", body: { text, parentCommentId }, idempotencyKey: createIdempotencyKey("reply") }),
  deleteComment: (commentId: ID) => sendRequestToStudioServer<void>(`/api/v1/comments/${id(commentId)}`, { method: "DELETE" }),
  pinComment: (postId: ID, commentId: ID) => sendRequestToStudioServer<PostComment>(`/api/v1/posts/${id(postId)}/comments/${id(commentId)}/pin`, { method: "PUT" }),
  unpinComment: (postId: ID, commentId: ID) => sendRequestToStudioServer<void>(`/api/v1/posts/${id(postId)}/comments/${id(commentId)}/pin`, { method: "DELETE" }),
};
