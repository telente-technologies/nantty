import { describe, expect, it } from "vitest";

import type { CommentView } from "../../src/modules/comments/models/comment.model.js";
import { buildSavedCommentItem } from "../../src/modules/saves/services/savedItemView.service.js";

const comment = {
  id: "c_1",
  postId: "p_9",
  parentCommentId: null,
  rootCommentId: null,
  author: { id: "u_1", name: "Ada", username: "ada", avatarUrl: "https://cdn.example/a.jpg" },
  text: "Where did you get this?",
} as unknown as CommentView;

const base = { id: "s_1", type: "comment" as const, targetId: "c_1", savedAt: "2026-10-10T00:00:00.000Z", collectionId: null };

describe("buildSavedCommentItem", () => {
  it("includes the parent post id at the top level so clients can open the reply", () => {
    const item = buildSavedCommentItem(base, comment);
    expect(item.postId).toBe("p_9");
    expect(item.comment).toBe(comment);
    expect(item.preview).toMatchObject({ title: "Where did you get this?", author: "ada", href: "/post/p_9/comment/c_1" });
  });

  it("uses a null title for empty comment text", () => {
    expect(buildSavedCommentItem(base, { ...comment, text: "" }).preview.title).toBeNull();
  });
});
