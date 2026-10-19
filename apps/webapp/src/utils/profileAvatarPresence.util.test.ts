import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  doesProfileAvatarOpenMenu,
  listProfileAvatarMenuOptions,
  openLiveWhenStillOn,
  openStoryWhenStillActive,
  resolveProfileAvatarPresence,
  storyNoLongerAvailableMessage,
} from "./profileAvatarPresence.util";

const presenceFor = (story: { hasActiveStory: boolean; hasUnseenStory: boolean }, liveStreamId: string | null, hidden = false) =>
  resolveProfileAvatarPresence({ storyStatus: story, liveStatus: { liveStreamId, startedAt: null }, isProfileHiddenFromViewer: hidden });

describe("web profile avatar presence", () => {
  it("picks the ring for each state, with live taking precedence", () => {
    assert.equal(presenceFor({ hasActiveStory: false, hasUnseenStory: false }, null).ring, "none");
    assert.equal(presenceFor({ hasActiveStory: true, hasUnseenStory: true }, null).ring, "storyUnseen");
    assert.equal(presenceFor({ hasActiveStory: true, hasUnseenStory: false }, null).ring, "storySeen");
    assert.equal(presenceFor({ hasActiveStory: false, hasUnseenStory: false }, "live_1").ring, "live");
    assert.equal(presenceFor({ hasActiveStory: true, hasUnseenStory: true }, "live_1").ring, "live");
  });

  it("lists menu items per state and opens the picture directly when there is nothing else", () => {
    assert.deepEqual(listProfileAvatarMenuOptions(presenceFor({ hasActiveStory: true, hasUnseenStory: true }, "live_1"), true), ["watchLive", "viewStory", "viewProfilePicture"]);
    assert.deepEqual(listProfileAvatarMenuOptions(presenceFor({ hasActiveStory: false, hasUnseenStory: false }, "live_1"), true), ["watchLive", "viewProfilePicture"]);
    assert.equal(doesProfileAvatarOpenMenu(presenceFor({ hasActiveStory: false, hasUnseenStory: false }, null)), false);
  });

  it("shows nothing for a hidden private or blocked profile", () => {
    const presence = presenceFor({ hasActiveStory: true, hasUnseenStory: true }, "live_1", true);
    assert.equal(presence.ring, "none");
    assert.equal(doesProfileAvatarOpenMenu(presence), false);
  });

  it("routes to the right story or stream, and explains an expired story", async () => {
    const opened: string[] = [];
    const reported: string[] = [];
    const handlers = { open: (id: string) => opened.push(id), reportUnavailable: (message: string) => reported.push(message) };
    await openStoryWhenStillActive("u_3", async () => [{ id: "st_1" }], handlers);
    await openLiveWhenStillOn("u_3", async () => ({ liveStreamId: "live_9", startedAt: null }), handlers);
    await openStoryWhenStillActive("u_4", async () => [], handlers);
    assert.deepEqual(opened, ["u_3", "live_9"]);
    assert.deepEqual(reported, [storyNoLongerAvailableMessage]);
  });
});
