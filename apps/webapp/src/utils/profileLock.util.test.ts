import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isGuestBrowsablePage, isPublicApiRead } from "@/config/guestBrowsing.config";
import type { FollowRequest, FollowState, Page } from "@/types";

import { followRequestQueriesToRefresh, removeFollowRequestFromPage } from "./followRequests.util";
import { createFollowToggleRunner } from "./followToggle.util";
import { buildOwnProfileMenuItems } from "./ownProfileMenu.util";
import { followButtonLabelForState, followFailureMessage, followStatusPollIntervalMs, lockedProfileCopyByLock, resolveProfileLock } from "./profileLock.util";

describe("locked view of a private profile", () => {
  const cases: readonly (readonly [string, FollowState, string, string])[] = [
    ["guest", "none", "private", "Follow"],
    ["none", "none", "private", "Follow"],
    ["requested", "requested", "private", "Requested"],
    ["rejected", "rejected", "private", "Follow"],
    ["accepted", "accepted", "open", "Following"],
    ["blocked", "blocked", "blocked", "Unblock"],
  ];
  for (const [name, followState, lock, label] of cases) {
    it(`${name} viewer sees the ${lock} view with a ${label} button`, () => {
      assert.equal(resolveProfileLock({ isSelf: false, isPrivate: true, followState }), lock);
      assert.equal(followButtonLabelForState(followState), label);
    });
  }

  it("never locks the owner and keeps public profiles open unless the viewer blocked them", () => {
    assert.equal(resolveProfileLock({ isSelf: true, isPrivate: true, followState: "none" }), "open");
    assert.equal(resolveProfileLock({ isSelf: false, isPrivate: false, followState: "none" }), "open");
    assert.equal(resolveProfileLock({ isSelf: false, isPrivate: false, followState: "blocked" }), "blocked");
  });

  it("uses the same copy as the app", () => {
    assert.deepEqual(lockedProfileCopyByLock.private, { title: "This account is private", message: "Follow to see their photos and videos." });
  });

  it("keeps checking a pending request so the profile unlocks once accepted", () => {
    assert.equal(followStatusPollIntervalMs("requested"), 15_000);
    for (const state of ["none", "accepted", "rejected", "blocked", undefined] as const) assert.equal(followStatusPollIntervalMs(state), false);
  });

  it("explains the re-request cooldown", () => {
    assert.equal(followFailureMessage({ code: "FOLLOW_REQUEST_COOLDOWN" }), "You can ask to follow this account again in a little while.");
    assert.equal(followFailureMessage(new Error("offline")), "Couldn't update follow. Try again.");
  });

  it("shows Requested at once for a private account and asks before cancelling", async () => {
    const applied: FollowState[] = [];
    const confirmations: string[] = [];
    const runner = createFollowToggleRunner({
      confirm: async (copy) => { confirmations.push(copy.title); return true; },
      follow: async () => ({ state: "requested" }),
      unfollow: async () => undefined,
      apply: (state) => applied.push(state),
      onFailed: () => undefined,
      optimisticFollowState: "requested",
    });
    assert.equal(await runner.run("none", "ada"), "requested");
    assert.deepEqual(applied, ["requested"]);
    assert.equal(await runner.run("requested", "ada"), "none");
    assert.deepEqual(confirmations, ["Cancel follow request?"]);
  });
});

describe("follow requests", () => {
  const request = (id: string): FollowRequest => ({ id, requester: { id: `u-${id}`, name: id, username: id, avatarUrl: null }, createdAt: "2026-10-17T10:00:00Z" } as FollowRequest);
  const page: Page<FollowRequest> = { data: [request("r1"), request("r2")], nextCursor: null };

  it("drops a confirmed or deleted row optimistically and leaves the rest", () => {
    assert.deepEqual(removeFollowRequestFromPage(page, "r1")?.data.map((entry) => entry.id), ["r2"]);
    assert.equal(removeFollowRequestFromPage(undefined, "r1"), undefined);
    assert.deepEqual(page.data.map((entry) => entry.id), ["r1", "r2"]);
  });

  it("refreshes the badge on a new request and unlocks the owner's profile on acceptance", () => {
    assert.deepEqual(followRequestQueriesToRefresh({ kind: "followRequest", actor: { id: "requester" } }), [["followRequests"]]);
    assert.deepEqual(followRequestQueriesToRefresh({ kind: "followRequestAccepted", actor: { id: "owner" } })[0], ["followStatus", "owner"]);
    assert.deepEqual(followRequestQueriesToRefresh({ kind: "mention", actor: { id: "x" } }), []);
  });

  it("badges the Follow requests menu entry", () => {
    const items = buildOwnProfileMenuItems({ isSeller: false, isPrivate: true, verificationBadgeVisible: false, creatorEntry: { label: "Creator", href: "/creator", disabled: false } as never, pendingFollowRequests: 3, hasMoreFollowRequests: false });
    assert.equal(items.find((item) => item.key === "followRequests")?.badge, "3");
  });
});

describe("guest stories on the web", () => {
  it("let guests open a user's public stories and story ring, like the app", () => {
    assert.equal(isGuestBrowsablePage("/stories/0f8a1c2e"), true);
    assert.equal(isGuestBrowsablePage("/stories"), false);
    assert.equal(isPublicApiRead("GET", "/api/v1/users/0f8a1c2e/stories"), true);
    assert.equal(isPublicApiRead("GET", "/api/v1/users/0f8a1c2e/story-status"), true);
    assert.equal(isPublicApiRead("POST", "/api/v1/stories/s1/seen"), false);
    assert.equal(isPublicApiRead("GET", "/api/v1/users/me/follow-requests"), false);
  });
});
