import {
  describeProfileAvatarForAccessibility,
  doesProfileAvatarOpenMenu,
  listProfileAvatarMenuOptions,
  liveNoLongerAvailableMessage,
  openLiveWhenStillOn,
  openStoryWhenStillActive,
  profileAvatarOpenFailedMessage,
  resolveProfileAvatarPresence,
  storyNoLongerAvailableMessage,
} from "@/utils/profileAvatarPresence.util";

const noStory = { hasActiveStory: false, hasUnseenStory: false };
const unseenStory = { hasActiveStory: true, hasUnseenStory: true };
const seenStory = { hasActiveStory: true, hasUnseenStory: false };
const notLive = { liveStreamId: null, startedAt: null };
const live = { liveStreamId: "live_42", startedAt: "2026-10-17T11:00:00Z" };

describe("profile avatar presence", () => {
  it.each([
    ["no story and not live", noStory, notLive, "none", []],
    ["an unseen story", unseenStory, notLive, "storyUnseen", ["viewStory", "viewProfilePicture"]],
    ["only seen stories", seenStory, notLive, "storySeen", ["viewStory", "viewProfilePicture"]],
    ["a live with no story", noStory, live, "live", ["watchLive", "viewProfilePicture"]],
    ["a live and an unseen story", unseenStory, live, "live", ["watchLive", "viewStory", "viewProfilePicture"]],
  ] as const)("shows the right ring and options for %s", (_, storyStatus, liveStatus, ring, options) => {
    const presence = resolveProfileAvatarPresence({ storyStatus, liveStatus, isProfileHiddenFromViewer: false });
    expect(presence.ring).toBe(ring);
    expect(doesProfileAvatarOpenMenu(presence)).toBe(options.length > 0);
    expect(listProfileAvatarMenuOptions(presence, true)).toEqual(ring === "none" ? ["viewProfilePicture"] : options);
  });

  it("shows nothing on a private profile the viewer doesn't follow, even if a status leaks through", () => {
    const presence = resolveProfileAvatarPresence({ storyStatus: unseenStory, liveStatus: live, isProfileHiddenFromViewer: true });
    expect(presence).toEqual({ ring: "none", liveStreamId: null, hasActiveStory: false });
    expect(doesProfileAvatarOpenMenu(presence)).toBe(false);
  });

  it("shows nothing for a blocked user, whose statuses come back empty from the server", () => {
    const presence = resolveProfileAvatarPresence({ storyStatus: noStory, liveStatus: notLive, isProfileHiddenFromViewer: false });
    expect(presence.ring).toBe("none");
    expect(listProfileAvatarMenuOptions(presence, true)).toEqual(["viewProfilePicture"]);
  });

  it("treats a missing or failed status as no ring rather than guessing", () => {
    expect(resolveProfileAvatarPresence({ storyStatus: undefined, liveStatus: null, isProfileHiddenFromViewer: false }).ring).toBe("none");
    expect(resolveProfileAvatarPresence({ storyStatus: null, liveStatus: { liveStreamId: "", startedAt: null }, isProfileHiddenFromViewer: false }).liveStreamId).toBeNull();
  });

  it("leaves out View profile picture when there is no picture", () => {
    const presence = resolveProfileAvatarPresence({ storyStatus: unseenStory, liveStatus: notLive, isProfileHiddenFromViewer: false });
    expect(listProfileAvatarMenuOptions(presence, false)).toEqual(["viewStory"]);
  });

  it("labels the avatar for screen readers", () => {
    expect(describeProfileAvatarForAccessibility(resolveProfileAvatarPresence({ storyStatus: unseenStory, liveStatus: notLive, isProfileHiddenFromViewer: false }), "Ada")).toBe("Ada, View story or profile picture");
    expect(describeProfileAvatarForAccessibility(resolveProfileAvatarPresence({ storyStatus: noStory, liveStatus: live, isProfileHiddenFromViewer: false }), "Ada")).toContain("Live now");
    expect(describeProfileAvatarForAccessibility(resolveProfileAvatarPresence({ storyStatus: noStory, liveStatus: notLive, isProfileHiddenFromViewer: false }), "Ada")).toBe("View Ada's profile picture");
  });
});

describe("opening a story or live from the avatar", () => {
  const handlers = () => ({ open: jest.fn(), reportUnavailable: jest.fn() });

  it("opens the story viewer at that user's stories", async () => {
    const fetchStories = jest.fn().mockResolvedValue([{ id: "st_1" }]);
    const spies = handlers();
    await expect(openStoryWhenStillActive("u_7", fetchStories, spies)).resolves.toBe(true);
    expect(fetchStories).toHaveBeenCalledWith("u_7");
    expect(spies.open).toHaveBeenCalledWith("u_7");
    expect(spies.reportUnavailable).not.toHaveBeenCalled();
  });

  it("explains instead of opening when the story expired between render and tap", async () => {
    const spies = handlers();
    await expect(openStoryWhenStillActive("u_7", jest.fn().mockResolvedValue([]), spies)).resolves.toBe(false);
    expect(spies.open).not.toHaveBeenCalled();
    expect(spies.reportUnavailable).toHaveBeenCalledWith(storyNoLongerAvailableMessage);
  });

  it("reports a failed fetch without opening an empty viewer", async () => {
    const spies = handlers();
    await openStoryWhenStillActive("u_7", jest.fn().mockRejectedValue(new Error("offline")), spies);
    expect(spies.open).not.toHaveBeenCalled();
    expect(spies.reportUnavailable).toHaveBeenCalledWith(profileAvatarOpenFailedMessage);
  });

  it("opens the stream the server says is live right now", async () => {
    const spies = handlers();
    await expect(openLiveWhenStillOn("u_7", jest.fn().mockResolvedValue({ liveStreamId: "live_99", startedAt: null }), spies)).resolves.toBe(true);
    expect(spies.open).toHaveBeenCalledWith("live_99");
  });

  it("explains instead of opening when the live ended between render and tap", async () => {
    const spies = handlers();
    await openLiveWhenStillOn("u_7", jest.fn().mockResolvedValue({ liveStreamId: null, startedAt: null }), spies);
    expect(spies.open).not.toHaveBeenCalled();
    expect(spies.reportUnavailable).toHaveBeenCalledWith(liveNoLongerAvailableMessage);
  });
});
