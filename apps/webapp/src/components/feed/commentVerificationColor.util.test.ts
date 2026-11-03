import assert from "node:assert/strict";
import test from "node:test";

import type { Comment, UserSummary } from "@/types";
import { commentVerificationColor } from "./commentVerificationColor.util";

const author = (overrides: Partial<UserSummary> = {}): UserSummary => ({
  id: "user-1",
  name: "Ayo",
  username: "ayo",
  avatarUrl: null,
  verified: false,
  ...overrides,
});

const comment = (overrides: Partial<Comment> = {}): Comment => ({
  id: "comment-1",
  postId: "post-1",
  parentCommentId: null,
  rootCommentId: null,
  author: author(),
  text: "A comment",
  createdAt: "2026-11-02T12:00:00.000Z",
  likes: 0,
  liked: false,
  bookmarked: false,
  replyCount: 0,
  isPinned: false,
  pinnedAt: null,
  mentions: [],
  videoReplies: [],
  videoReplyBlocked: false,
  isPostAuthor: false,
  quotedPost: null,
  quotedPostUnavailable: false,
  ...overrides,
});

test("uses the active verification color for comment authors", () => {
  for (const color of ["blue", "gold", "black"] as const) {
    assert.equal(commentVerificationColor(comment({ author: author({ verification: { status: "active", type: "personal", color, tier: "VERIFIED", badgeVisible: true } }) })), color);
  }
});

test("does not expose inactive checkmarks and keeps legacy blue verification", () => {
  assert.equal(commentVerificationColor(comment({ author: author({ verification: { status: "revoked", type: "personal", color: "gold", tier: "VERIFIED", badgeVisible: false } }) })), null);
  assert.equal(commentVerificationColor(comment({ author: author({ verified: true }) })), "blue");
  assert.equal(commentVerificationColor(comment()), null);
});

test("a managed profile uses its own checkmark and never inherits the owner's", () => {
  const businessComment = comment({
    author: author({ verified: true, verification: { status: "active", type: "personal", color: "blue", tier: "VERIFIED", badgeVisible: true } }),
    postedAs: { id: "profile-1", kind: "business", name: "Nantty Store", handle: "nantty", avatarUrl: null, checkmark: "gold" },
  });
  assert.equal(commentVerificationColor(businessComment), "gold");
  assert.equal(commentVerificationColor({ ...businessComment, postedAs: { ...businessComment.postedAs!, checkmark: null } }), null);
});
