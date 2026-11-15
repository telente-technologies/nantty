import assert from "node:assert/strict";
import test from "node:test";

import { messengerStoriesService, parseStoryTray, parseUserStories } from "./messengerStories.service";

const person = { id: "person-1", name: "Ada", username: "ada", avatarUrl: null };

test("story tray parser retains valid people and unseen state", () => {
  assert.deepEqual(parseStoryTray({ data: [{ user: person, hasUnseen: true }, { user: { id: "bad" }, hasUnseen: true }, null] }), [{ user: person, hasUnseen: true }]);
});

test("story parser accepts supported image and video media without inventing URLs", () => {
  const stories = parseUserStories([
    { id: "story-1", author: person, media: { type: "image", url: "https://media.example/image.jpg" }, createdAt: "2026-11-14T10:00:00Z", seen: false },
    { id: "story-2", author: person, media: { type: "video", posterUrl: "https://media.example/poster.jpg" }, createdAt: "2026-11-14T10:01:00Z", seen: true },
    { id: "story-invalid", author: person, media: { type: "audio" }, createdAt: "now" },
  ]);
  assert.deepEqual(stories.map(({ id, media }) => [id, media.type, media.url, media.posterUrl]), [
    ["story-1", "image", "https://media.example/image.jpg", null],
    ["story-2", "video", null, "https://media.example/poster.jpg"],
  ]);
});

test("story API calls use the existing authenticated endpoints", async () => {
  const calls: { path: string; method: string }[] = [];
  const request = async <T,>(path: string, options?: { readonly method?: string }): Promise<T> => {
    calls.push({ path, method: options?.method ?? "GET" });
    return [] as T;
  };
  await messengerStoriesService.fetchTray(request);
  await messengerStoriesService.fetchForUser(request, "user/one");
  await messengerStoriesService.markSeen(request, "story/one");
  await messengerStoriesService.replyToStory(request, "story/one", { deviceId: "device-1", ciphertext: "ciphertext" }, "reply-key-123");
  await messengerStoriesService.publishPhoto(request, { mediaId: "media-1" });
  assert.deepEqual(calls, [
    { path: "/api/v1/stories/tray", method: "GET" },
    { path: "/api/v1/users/user%2Fone/stories", method: "GET" },
    { path: "/api/v1/stories/story%2Fone/seen", method: "POST" },
    { path: "/api/v1/stories/story%2Fone/replies", method: "POST" },
    { path: "/api/v1/stories", method: "POST" },
  ]);
});

test("Story reply request contains ciphertext only and carries its retry key", async () => {
  let sentOptions: { readonly method?: string; readonly headers?: Readonly<Record<string, string>>; readonly body?: unknown } | undefined;
  const request = async <T,>(_path: string, options?: typeof sentOptions): Promise<T> => {
    sentOptions = options;
    return { id: "message-1" } as T;
  };
  await messengerStoriesService.replyToStory(request, "story-1", { deviceId: "device-1", ciphertext: "encrypted-payload", protocol: "signal-v1" }, "stable-retry-key");
  assert.deepEqual(sentOptions, {
    method: "POST",
    headers: { "Idempotency-Key": "stable-retry-key" },
    body: { encryption: { deviceId: "device-1", ciphertext: "encrypted-payload", protocol: "signal-v1" } },
  });
});

test("photo publish sends only the uploaded media reference", async () => {
  let sentBody: unknown;
  const request = async <T,>(_path: string, options?: { readonly method?: string; readonly body?: unknown }): Promise<T> => {
    sentBody = options?.body;
    return {} as T;
  };
  await messengerStoriesService.publishPhoto(request, { mediaId: "media-photo-1" });
  assert.deepEqual(sentBody, { mediaId: "media-photo-1" });
});
