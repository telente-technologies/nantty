import assert from "node:assert/strict";
import test from "node:test";
import { createBubbleDraftStore } from "./bubbleDrafts.store";

test("draft records persist by account and conversation", async () => {
  const records = new Map<string, string>();
  const store = createBubbleDraftStore({
    async get(key) { return records.get(key) ?? null; },
    async set(key, value) { records.set(key, value); },
    async delete(key) { records.delete(key); },
  });
  await store.save("account-a", "conversation-1", "first draft");
  await store.save("account-a", "conversation-2", "second draft");
  await store.save("account-b", "conversation-1", "other account");
  assert.equal(await store.get("account-a", "conversation-1"), "first draft");
  assert.equal(await store.get("account-a", "conversation-2"), "second draft");
  assert.equal(await store.get("account-b", "conversation-1"), "other account");
  await store.save("account-a", "conversation-1", "");
  assert.equal(await store.get("account-a", "conversation-1"), "");
  assert.equal(await store.get("account-b", "conversation-1"), "other account");
});

test("draft writes serialize per conversation so an older write cannot win", async () => {
  const records = new Map<string, string>();
  const store = createBubbleDraftStore({
    async get(key) { return records.get(key) ?? null; },
    async set(key, value) { if (value === "old") await new Promise((resolve) => setTimeout(resolve, 20)); records.set(key, value); },
    async delete(key) { records.delete(key); },
  });
  const first = store.save("account", "conversation", "old");
  const second = store.save("account", "conversation", "new");
  await Promise.all([first, second]);
  assert.equal(await store.get("account", "conversation"), "new");
});
