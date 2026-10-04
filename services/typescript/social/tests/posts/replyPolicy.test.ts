import { describe, expect, it } from "vitest";

import { decideReplyPermission, mentionedUserIdsFromEntities, type ReplyPermissionInput } from "../../src/modules/posts/services/replyPolicy.service.js";

const base: ReplyPermissionInput = { policy: "everyone", viewerId: "viewer", authorId: "author", viewerFollowsAuthor: false, authorFollowsViewer: false, mentionedUserIds: [], subscriberOnly: false, viewerHasSubscriberAccess: false };
const decide = (overrides: Partial<ReplyPermissionInput>) => decideReplyPermission({ ...base, ...overrides });

describe("reply permissions", () => {
  it("lets anyone signed in reply to an open post and always lets the author reply", () => {
    expect(decide({}).allowed).toBe(true);
    expect(decide({ policy: "off", viewerId: "author" }).allowed).toBe(true);
    expect(decide({ viewerId: undefined })).toMatchObject({ allowed: false, reason: "SIGN_IN_REQUIRED" });
  });

  it("refuses replies with a clear reason for each audience", () => {
    expect(decide({ policy: "off" })).toEqual({ allowed: false, reason: "REPLIES_OFF", message: "The author turned off replies for this post." });
    expect(decide({ policy: "following" })).toMatchObject({ allowed: false, reason: "AUTHOR_FOLLOWS_ONLY" });
    expect(decide({ policy: "following", authorFollowsViewer: true }).allowed).toBe(true);
    expect(decide({ policy: "followers" })).toMatchObject({ allowed: false, reason: "FOLLOWERS_ONLY" });
    expect(decide({ policy: "followers", viewerFollowsAuthor: true }).allowed).toBe(true);
    expect(decide({ policy: "mentioned" })).toMatchObject({ allowed: false, reason: "MENTIONED_ONLY" });
    expect(decide({ policy: "mentioned", mentionedUserIds: ["viewer"] }).allowed).toBe(true);
  });

  it("keeps subscriber-only conversations for subscribers", () => {
    expect(decide({ subscriberOnly: true })).toMatchObject({ allowed: false, reason: "SUBSCRIBERS_ONLY" });
    expect(decide({ subscriberOnly: true, viewerHasSubscriberAccess: true }).allowed).toBe(true);
    expect(decide({ subscriberOnly: true, policy: "off", viewerHasSubscriberAccess: true })).toMatchObject({ reason: "REPLIES_OFF" });
  });

  it("reads mentioned people from stored mention entities", () => {
    expect(mentionedUserIdsFromEntities([{ userId: "a", username: "ada", start: 0, length: 4 }, { type: "all", start: 5, length: 4 }])).toEqual(["a"]);
    expect(mentionedUserIdsFromEntities(null)).toEqual([]);
  });
});
