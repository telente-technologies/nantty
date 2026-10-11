import { ApiError } from "@/errors/api.error";
import type { NotificationCategory, NotificationPreference, PostComment, PostCommentThread } from "@/types/studioSocial.type";

import { createMockRoute, type MockRoute } from "./registry.mock";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const me = { id: "u_me", name: "Temitope Adeyemi", username: "temi.creates", avatarUrl: null };
const fan = (index: number, name: string) => ({ id: `fan_${index}`, name, username: name.toLowerCase().replace(/\s+/g, "."), avatarUrl: null });

const comment = (id: string, postId: string, author: PostComment["author"], text: string, minutes: number, extra: Partial<PostComment> = {}): PostComment => ({
  id, postId, parentCommentId: null, author, text, createdAt: minutesAgo(minutes), likes: 0, replyCount: 0, isPinned: false, isPostAuthor: author.id === me.id, ...extra,
});

const commentsByPost = new Map<string, PostComment[]>([
  ["post_clip_1", [
    comment("cm_1", "post_clip_1", fan(1, "Kemi Ade"), "How long does the clay need to dry before firing?", 42, { likes: 12 }),
    comment("cm_2", "post_clip_1", fan(2, "Chidi Okafor"), "This is so satisfying to watch", 95, { likes: 30, replyCount: 1 }),
    comment("cm_2r", "post_clip_1", me, "Thank you! New one drops Sunday.", 80, { parentCommentId: "cm_2" }),
  ]],
  ["post_2", [
    comment("cm_3", "post_2", fan(3, "Amaka Eze"), "The cobalt blue one first please", 300, { isPinned: true, likes: 8 }),
    comment("cm_4", "post_2", fan(4, "Tobi Bakare"), "Will you ship to Abuja?", 640),
  ]],
]);

const topLevelWithReplies = (postId: string): (PostCommentThread)[] => {
  const all = commentsByPost.get(postId) ?? [];
  return all
    .filter((entry) => entry.parentCommentId === null)
    .map((entry) => {
      const replies = all.filter((reply) => reply.parentCommentId === entry.id);
      return { ...entry, type: "comment" as const, replyCount: replies.length, previewReplies: replies.slice(0, 3) };
    });
};

const findComment = (commentId: string) => {
  for (const [postId, list] of commentsByPost) {
    const found = list.find((entry) => entry.id === commentId);
    if (found) return { postId, found };
  }
  throw new ApiError(404, "That comment no longer exists.", "COMMENT_NOT_FOUND");
};

const notificationPreferences = new Map<NotificationCategory, NotificationPreference>(
  (["creator", "social", "live", "payments", "milestones", "marketing", "trust"] as const).map((category) => [
    category, { category, push: category !== "marketing", email: category === "payments" || category === "trust", locked: category === "trust" },
  ]),
);

let privacy = { whoCanMentionMe: "everyone", whoCanMessageMe: "followers" };

export const studioSocialMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/posts/:postId/comments", ({ params }) => ({ data: topLevelWithReplies(params.postId!), nextCursor: null })),
  createMockRoute("POST", "/api/v1/posts/:postId/comments", ({ params, body }) => {
    const payload = (body ?? {}) as { text?: unknown; parentCommentId?: unknown };
    const text = String(payload.text ?? "").trim();
    if (!text || text.length > 1500) throw new ApiError(400, "Write a reply between 1 and 1500 characters.", "VALIDATION_FAILED");
    const parentCommentId = typeof payload.parentCommentId === "string" ? payload.parentCommentId : null;
    if (parentCommentId) findComment(parentCommentId);
    const created = comment(`cm_${Date.now().toString(36)}`, params.postId!, me, text, 0, { parentCommentId });
    commentsByPost.set(params.postId!, [...(commentsByPost.get(params.postId!) ?? []), created]);
    return created;
  }),
  createMockRoute("DELETE", "/api/v1/comments/:commentId", ({ params }) => {
    const { postId } = findComment(params.commentId!);
    commentsByPost.set(postId, (commentsByPost.get(postId) ?? []).filter((entry) => entry.id !== params.commentId && entry.parentCommentId !== params.commentId));
    return undefined;
  }),
  createMockRoute("PUT", "/api/v1/posts/:postId/comments/:commentId/pin", ({ params }) => {
    const { postId, found } = findComment(params.commentId!);
    if (postId !== params.postId) throw new ApiError(404, "That comment isn't on this post.", "COMMENT_NOT_FOUND");
    commentsByPost.set(postId, (commentsByPost.get(postId) ?? []).map((entry) => ({ ...entry, isPinned: entry.id === found.id })));
    return { ...found, isPinned: true };
  }),
  createMockRoute("DELETE", "/api/v1/posts/:postId/comments/:commentId/pin", ({ params }) => {
    commentsByPost.set(params.postId!, (commentsByPost.get(params.postId!) ?? []).map((entry) => (entry.id === params.commentId ? { ...entry, isPinned: false } : entry)));
    return undefined;
  }),
  createMockRoute("GET", "/api/v1/notifications/preferences", () => ({ data: [...notificationPreferences.values()], nextCursor: null })),
  createMockRoute("PATCH", "/api/v1/notifications/preferences", ({ body }) => {
    const payload = (body ?? {}) as { category?: unknown; push?: unknown; email?: unknown };
    const current = notificationPreferences.get(payload.category as NotificationCategory);
    if (!current) throw new ApiError(400, "category is not supported", "VALIDATION_FAILED");
    if (current.locked) throw new ApiError(409, "This category can't be turned off.", "PREFERENCE_LOCKED");
    if (typeof payload.push !== "boolean" && typeof payload.email !== "boolean") throw new ApiError(400, "Set push or email.", "VALIDATION_FAILED");
    const updated = { ...current, ...(typeof payload.push === "boolean" ? { push: payload.push } : {}), ...(typeof payload.email === "boolean" ? { email: payload.email } : {}) };
    notificationPreferences.set(current.category, updated);
    return updated;
  }),
  createMockRoute("GET", "/api/v1/users/me/mention-privacy", () => ({ whoCanMentionMe: privacy.whoCanMentionMe })),
  createMockRoute("PUT", "/api/v1/users/me/mention-privacy", ({ body }) => {
    const value = (body as { whoCanMentionMe?: unknown } | null)?.whoCanMentionMe;
    if (!["everyone", "following", "no_one"].includes(String(value))) throw new ApiError(400, "whoCanMentionMe is not supported", "VALIDATION_FAILED");
    privacy = { ...privacy, whoCanMentionMe: String(value) };
    return { whoCanMentionMe: privacy.whoCanMentionMe };
  }),
  createMockRoute("GET", "/api/v1/users/me/message-privacy", () => ({ whoCanMessageMe: privacy.whoCanMessageMe })),
  createMockRoute("PUT", "/api/v1/users/me/message-privacy", ({ body }) => {
    const value = (body as { whoCanMessageMe?: unknown } | null)?.whoCanMessageMe;
    if (!["everyone", "following", "followers", "nobody"].includes(String(value))) throw new ApiError(400, "whoCanMessageMe is not supported", "VALIDATION_FAILED");
    privacy = { ...privacy, whoCanMessageMe: String(value) };
    return { whoCanMessageMe: privacy.whoCanMessageMe };
  }),
];
