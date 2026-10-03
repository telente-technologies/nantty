import { describe, expect, it } from "vitest";

import { decideFollowOutcome, decideProfileVisibility, deriveViewerFollowState } from "../../src/modules/follows/services/followRules.service.js";

const open = { followerIsBlockedByTarget: false, followerHasBlockedTarget: false, targetIsPrivate: false, existing: undefined } as const;

describe("decideFollowOutcome", () => {
  it("accepts immediately for a public profile", () => {
    expect(decideFollowOutcome(open)).toEqual({ outcome: "change", state: "accepted" });
  });
  it("requests for a private profile", () => {
    expect(decideFollowOutcome({ ...open, targetIsPrivate: true })).toEqual({ outcome: "change", state: "requested" });
  });
  it("is idempotent for requested and accepted", () => {
    expect(decideFollowOutcome({ ...open, targetIsPrivate: true, existing: "requested" })).toEqual({ outcome: "unchanged", state: "requested" });
    expect(decideFollowOutcome({ ...open, existing: "accepted" })).toEqual({ outcome: "unchanged", state: "accepted" });
  });
  it("lets a rejected follower ask again", () => {
    expect(decideFollowOutcome({ ...open, targetIsPrivate: true, existing: "rejected" })).toEqual({ outcome: "change", state: "requested" });
  });
  it("refuses when either side blocked", () => {
    expect(decideFollowOutcome({ ...open, followerHasBlockedTarget: true })).toEqual({ outcome: "refused" });
    expect(decideFollowOutcome({ ...open, followerIsBlockedByTarget: true, existing: "accepted" })).toEqual({ outcome: "refused" });
  });
});

describe("deriveViewerFollowState", () => {
  it("lets a block override every state", () => {
    expect(deriveViewerFollowState(true, "accepted")).toBe("blocked");
  });
  it("maps stored states and none", () => {
    expect(deriveViewerFollowState(false, undefined)).toBe("none");
    expect(deriveViewerFollowState(false, "rejected")).toBe("rejected");
  });
});

describe("decideProfileVisibility", () => {
  const base = { viewerId: "v", ownerId: "o", ownerIsPrivate: true, viewerIsAcceptedFollower: false, ownerHasBlockedViewer: false };
  it("shows private lists only to accepted followers and the owner", () => {
    expect(decideProfileVisibility(base)).toBe("private");
    expect(decideProfileVisibility({ ...base, viewerIsAcceptedFollower: true })).toBe("visible");
    expect(decideProfileVisibility({ ...base, viewerId: "o" })).toBe("visible");
  });
  it("treats guests as non followers", () => {
    expect(decideProfileVisibility({ ...base, viewerId: undefined })).toBe("private");
    expect(decideProfileVisibility({ ...base, viewerId: undefined, ownerIsPrivate: false })).toBe("visible");
  });
  it("hides a profile from someone it blocked", () => {
    expect(decideProfileVisibility({ ...base, ownerIsPrivate: false, ownerHasBlockedViewer: true })).toBe("hidden");
  });
});
