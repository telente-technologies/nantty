import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { StoryTrayItem } from "@/types";

import { getStoryTrayNeighbors } from "./storyTrayNavigation.util";

const item = (id: string): StoryTrayItem => ({
  user: { id, name: id, username: id, avatarUrl: null, verified: false },
  hasUnseen: true,
});

describe("getStoryTrayNeighbors", () => {
  const tray = [item("first"), item("current"), item("last")];

  it("returns adjacent users in tray order", () => {
    assert.deepEqual(getStoryTrayNeighbors(tray, "current"), {
      previous: tray[0],
      next: tray[2],
    });
  });

  it("does not wrap before the first user or after the last user", () => {
    assert.deepEqual(getStoryTrayNeighbors(tray, "first"), { previous: undefined, next: tray[1] });
    assert.deepEqual(getStoryTrayNeighbors(tray, "last"), { previous: tray[1], next: undefined });
  });

  it("starts at the first tray user when the current user is not in the tray", () => {
    assert.deepEqual(getStoryTrayNeighbors(tray, "missing"), { previous: undefined, next: tray[0] });
  });
});
