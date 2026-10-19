import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { QueryClient } from "@tanstack/react-query";

import type { FollowState } from "@/types";

import {
  createFollowToggleRunner, followConfirmationCopy, followToggleActionFor, postNotificationOptions, setFollowStateEverywhere, setPostNotificationLevelEverywhere,
  shouldShowPostNotificationBell, type FollowConfirmationCopy, type FollowToggleDeps,
} from "./followToggle.util";

function harness(overrides: Partial<FollowToggleDeps> & { readonly answer?: boolean } = {}) {
  const applied: FollowState[] = [];
  const asked: FollowConfirmationCopy[] = [];
  const calls: string[] = [];
  const failures: unknown[] = [];
  const runner = createFollowToggleRunner({
    confirm: async (copy) => {
      asked.push(copy);
      return overrides.answer ?? true;
    },
    follow: overrides.follow ?? (async () => { calls.push("follow"); return { state: "accepted" }; }),
    unfollow: overrides.unfollow ?? (async () => { calls.push("unfollow"); }),
    apply: (state) => applied.push(state),
    onFailed: (error) => failures.push(error),
    optimisticFollowState: overrides.optimisticFollowState,
  });
  return { runner, applied, asked, calls, failures };
}

describe("follow confirmation copy", () => {
  it("asks only before unfollowing or cancelling a request", () => {
    assert.equal(followToggleActionFor("none"), "follow");
    assert.equal(followToggleActionFor("rejected"), "follow");
    assert.equal(followToggleActionFor("accepted"), "unfollow");
    assert.equal(followToggleActionFor("requested"), "cancelRequest");
    assert.equal(followConfirmationCopy("follow", "ada"), null);
    assert.deepEqual(followConfirmationCopy("unfollow", "ada"), { title: "Unfollow @ada?", description: "Their posts will no longer show up in your Following feed.", confirmLabel: "Unfollow", cancelLabel: "Cancel" });
    assert.equal(followConfirmationCopy("cancelRequest", "ada")?.title, "Cancel follow request?");
  });
});

describe("follow toggle runner", () => {
  it("follows without asking", async () => {
    const { runner, asked, applied } = harness();
    assert.equal(await runner.run("none", "ada"), "accepted");
    assert.equal(asked.length, 0);
    assert.deepEqual(applied, ["accepted"]);
  });

  it("settles a private account follow as requested", async () => {
    const { runner, applied } = harness({ follow: async () => ({ state: "requested" }) });
    assert.equal(await runner.run("none", "ada"), "requested");
    assert.deepEqual(applied, ["accepted", "requested"]);
  });

  it("shows Requested straight away for a private profile and rolls back when the follow fails", async () => {
    const privateFollow = harness({ optimisticFollowState: "requested", follow: async () => ({ state: "requested" }) });
    assert.equal(await privateFollow.runner.run("none", "ada"), "requested");
    assert.deepEqual(privateFollow.applied, ["requested"]);
    const failing = harness({ optimisticFollowState: "requested", follow: async () => { throw new Error("offline"); } });
    assert.equal(await failing.runner.run("none", "ada"), "none");
    assert.deepEqual(failing.applied, ["requested", "none"]);
    assert.equal(failing.failures.length, 1);
  });

  it("does nothing when the confirm is cancelled", async () => {
    const { runner, applied, calls, asked } = harness({ answer: false });
    assert.equal(await runner.run("accepted", "ada"), "accepted");
    assert.equal(asked[0]?.title, "Unfollow @ada?");
    assert.deepEqual(applied, []);
    assert.deepEqual(calls, []);
  });

  it("unfollows optimistically and cancels a pending request after confirming", async () => {
    const first = harness();
    assert.equal(await first.runner.run("accepted", "ada"), "none");
    assert.deepEqual(first.applied, ["none"]);
    assert.deepEqual(first.calls, ["unfollow"]);
    const second = harness();
    assert.equal(await second.runner.run("requested", "ada"), "none");
    assert.equal(second.asked[0]?.title, "Cancel follow request?");
  });

  it("rolls back when the unfollow fails", async () => {
    const failure = new Error("offline");
    const { runner, applied, failures } = harness({ unfollow: async () => { throw failure; } });
    assert.equal(await runner.run("accepted", "ada"), "accepted");
    assert.deepEqual(applied, ["none", "accepted"]);
    assert.deepEqual(failures, [failure]);
  });

  it("ignores a double tap while the first unfollow is in flight", async () => {
    let release: () => void = () => undefined;
    const { runner, calls, asked } = harness({ unfollow: () => new Promise<void>((resolve) => { calls.push("unfollow"); release = resolve; }) });
    const first = runner.run("accepted", "ada");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(runner.isBusy(), true);
    assert.equal(await runner.run("accepted", "ada"), "accepted");
    release();
    assert.equal(await first, "none");
    assert.deepEqual(calls, ["unfollow"]);
    assert.equal(asked.length, 1);
    assert.equal(runner.isBusy(), false);
  });
});

describe("follow caches", () => {
  it("updates every cached copy of the person and resets their post notification level on unfollow", () => {
    const client = new QueryClient();
    client.setQueryData(["feed"], [{ id: "p_1", author: { id: "u_1" }, isFollowingAuthor: true }]);
    client.setQueryData(["connections"], { data: [{ id: "u_1", isFollowing: true }, { id: "u_2", isFollowing: true }] });
    client.setQueryData(["profile", "u_1"], { id: "u_1", isFollowing: true, followState: "accepted", viewerPostNotifications: "posts_and_lives" });
    setFollowStateEverywhere(client, "u_1", "none");
    assert.deepEqual(client.getQueryData(["feed"]), [{ id: "p_1", author: { id: "u_1" }, isFollowingAuthor: false }]);
    assert.deepEqual(client.getQueryData(["connections"]), { data: [{ id: "u_1", isFollowing: false }, { id: "u_2", isFollowing: true }] });
    assert.deepEqual(client.getQueryData(["profile", "u_1"]), { id: "u_1", isFollowing: false, followState: "none", viewerPostNotifications: "off" });
    setPostNotificationLevelEverywhere(client, "u_1", "posts");
    assert.equal((client.getQueryData(["profile", "u_1"]) as { viewerPostNotifications: string }).viewerPostNotifications, "posts");
  });
});

describe("post notifications bell", () => {
  it("shows only for an accepted follow by a signed-in visitor", () => {
    assert.equal(shouldShowPostNotificationBell({ isSelf: false, isSignedIn: true, followState: "accepted" }), true);
    assert.equal(shouldShowPostNotificationBell({ isSelf: false, isSignedIn: true, followState: "requested" }), false);
    assert.equal(shouldShowPostNotificationBell({ isSelf: false, isSignedIn: true, followState: "blocked" }), false);
    assert.equal(shouldShowPostNotificationBell({ isSelf: true, isSignedIn: true, followState: "accepted" }), false);
    assert.equal(shouldShowPostNotificationBell({ isSelf: false, isSignedIn: false, followState: "accepted" }), false);
  });

  it("offers all posts, lives too and off", () => {
    assert.deepEqual(postNotificationOptions.map((option) => option.level), ["posts", "posts_and_lives", "off"]);
  });
});
