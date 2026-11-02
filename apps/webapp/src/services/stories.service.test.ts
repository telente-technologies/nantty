import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { chatCryptoService } from "./chatCrypto/chatCrypto.service";
import { storiesService } from "./stories.service";

const originalFetch = globalThis.fetch;
const originalEncrypt = chatCryptoService.encryptForConversation;

afterEach(() => {
  globalThis.fetch = originalFetch;
  chatCryptoService.encryptForConversation = originalEncrypt;
});

describe("replying to a story", () => {
  it("opens a conversation, encrypts a story reference, posts it, then confirms delivery", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      calls.push({ url, init });
      const payload = url.endsWith("/api/v1/conversations")
        ? { id: "conversation_1", peer: { id: "author_1" } }
        : { id: "message_1" };
      return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    let encryptionInput: unknown;
    let confirmedMessageId: string | null | undefined;
    chatCryptoService.encryptForConversation = (async (_conversation, _viewerId, input) => {
      encryptionInput = input;
      return {
        encryption: { deviceId: "device_1", ciphertext: "ciphertext", protocol: "signal-v1" },
        linkPreview: null,
        confirmSent: async (messageId) => { confirmedMessageId = messageId; },
      };
    }) as typeof chatCryptoService.encryptForConversation;

    await storiesService.replyToStory("story_1", "author_1", "viewer_1", "Lovely story");

    assert.deepEqual(calls.map(({ url, init }) => [url, init.method]), [
      ["/bff/api/v1/conversations", "POST"],
      ["/bff/api/v1/stories/story_1/replies", "POST"],
    ]);
    assert.deepEqual(encryptionInput, {
      text: "Lovely story",
      storyId: "story_1",
      sharedContent: { kind: "story", id: "story_1" },
    });
    assert.deepEqual(JSON.parse(String(calls[1]?.init.body)), {
      encryption: { deviceId: "device_1", ciphertext: "ciphertext", protocol: "signal-v1" },
    });
    assert.equal(confirmedMessageId, "message_1");
  });
});
