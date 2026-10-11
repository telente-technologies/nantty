import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canPublishComposerDraft, clearSavedComposerDraft, describePublishButton, EMPTY_COMPOSER_DRAFT, readQuoteParam, readSavedComposerDraft, saveComposerDraft } from "./composerDraft.util";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), removeItem: (key: string) => void values.delete(key), values };
}

describe("composer drafts", () => {
  it("keeps a quote draft in its own slot so it never overwrites the normal draft, and keeps the quote", () => {
    const storage = memoryStorage();
    saveComposerDraft(storage, "u_me", { ...EMPTY_COMPOSER_DRAFT, text: "my own post" });
    saveComposerDraft(storage, "u_me", { ...EMPTY_COMPOSER_DRAFT, text: "my take", quotedPostId: "post_3" }, "post_3");
    assert.equal(readSavedComposerDraft(storage, "u_me")?.text, "my own post");
    assert.equal(readSavedComposerDraft(storage, "u_me", "post_3")?.quotedPostId, "post_3");
    saveComposerDraft(storage, "u_me", { ...EMPTY_COMPOSER_DRAFT, quotedPostId: "post_3" }, "post_3");
    assert.equal(readSavedComposerDraft(storage, "u_me", "post_3"), null);
    clearSavedComposerDraft(storage, "u_me", "post_3");
    assert.equal(readSavedComposerDraft(storage, "u_me")?.text, "my own post");
  });

  it("accepts only safe quote ids from the URL and from storage", () => {
    assert.equal(readQuoteParam("post_3"), "post_3");
    assert.equal(readQuoteParam("0192f0a0-0000-7000-8000-0000000000a1"), "0192f0a0-0000-7000-8000-0000000000a1");
    assert.equal(readQuoteParam("../../admin"), null);
    assert.equal(readQuoteParam(""), null);
    assert.equal(readQuoteParam(null), null);
    const storage = memoryStorage();
    storage.setItem("zudomart.composerDraft.u_me", JSON.stringify({ text: "x", quotedPostId: "<script>" }));
    assert.equal(readSavedComposerDraft(storage, "u_me")?.quotedPostId, null);
  });

  it("survives a refresh per signed-in account and is cleared once posted", () => {
    const storage = memoryStorage();
    saveComposerDraft(storage, "u_me", { ...EMPTY_COMPOSER_DRAFT, text: "half written", replyPolicy: "followers" });
    assert.equal(readSavedComposerDraft(storage, "u_me")?.text, "half written");
    assert.equal(readSavedComposerDraft(storage, "u_me")?.replyPolicy, "followers");
    assert.equal(readSavedComposerDraft(storage, "u_other"), null);
    clearSavedComposerDraft(storage, "u_me");
    assert.equal(readSavedComposerDraft(storage, "u_me"), null);
  });

  it("does not store empty drafts and ignores corrupt or blocked storage", () => {
    const storage = memoryStorage();
    saveComposerDraft(storage, "u_me", EMPTY_COMPOSER_DRAFT);
    assert.equal(storage.values.size, 0);
    storage.setItem("zudomart.composerDraft.u_me", "{not json");
    assert.equal(readSavedComposerDraft(storage, "u_me"), null);
    const blocked = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("QuotaExceeded"); }, removeItem: () => { throw new Error("SecurityError"); } };
    assert.equal(readSavedComposerDraft(blocked, "u_me"), null);
    assert.doesNotThrow(() => saveComposerDraft(blocked, "u_me", { ...EMPTY_COMPOSER_DRAFT, text: "x" }));
  });

  it("needs text or media within the limit, like the app", () => {
    assert.equal(canPublishComposerDraft(EMPTY_COMPOSER_DRAFT, 0, 280), false);
    assert.equal(canPublishComposerDraft({ ...EMPTY_COMPOSER_DRAFT, text: "   " }, 0, 280), false);
    assert.equal(canPublishComposerDraft(EMPTY_COMPOSER_DRAFT, 1, 280), true);
    assert.equal(canPublishComposerDraft({ ...EMPTY_COMPOSER_DRAFT, text: "x".repeat(281) }, 0, 280), false);
  });

  it("labels the button with upload progress, then posting", () => {
    assert.equal(describePublishButton(false, 1), "Post");
    assert.equal(describePublishButton(true, 0.42), "Uploading 42%…");
    assert.equal(describePublishButton(true, 1), "Posting…");
  });
});
