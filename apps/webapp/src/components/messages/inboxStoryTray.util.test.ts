import assert from "node:assert/strict";
import test from "node:test";

import type { StoryTrayItem } from "@/types";

import { buildInboxStoryItems } from "./inboxStoryTray.util";

const stories: StoryTrayItem[] = [
  {
    user: {
      id: "user/1",
      username: "ada",
      name: "Ada",
      avatarUrl: "https://cdn.example.test/ada.png",
      verified: false,
    },
    hasUnseen: true,
  },
];

test("inbox story links include the create-story action and encode user story routes", () => {
  const items = buildInboxStoryItems(stories);

  assert.deepEqual(items[0], {
    key: "own-story",
    href: "/create/story",
    name: "Your story",
    avatarUrl: null,
    hasUnseen: false,
    isOwnStory: true,
    accessibleLabel: "Add to your story",
  });
  assert.deepEqual(items[1], {
    key: "user/1",
    href: "/stories/user%2F1",
    name: "@ada",
    avatarUrl: "https://cdn.example.test/ada.png",
    hasUnseen: true,
    isOwnStory: false,
    accessibleLabel: "View @ada's story",
  });
});

test("an empty story tray still exposes the own-story entry", () => {
  assert.equal(buildInboxStoryItems([]).length, 1);
});
