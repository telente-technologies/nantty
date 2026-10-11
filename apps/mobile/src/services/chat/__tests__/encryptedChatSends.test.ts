const posted: { path: string; body: Record<string, unknown> }[] = [];
const encryptedInputs: unknown[] = [];

jest.mock("@/services/core/apiClient.service", () => ({
  generateIdempotencyKey: () => "key",
  api: {
    post: jest.fn(async (path: string, body: Record<string, unknown>) => {
      posted.push({ path, body });
      return { id: "srv-1", conversationId: "c1", senderId: "me", text: "", createdAt: "2026-10-11T10:00:00.000Z", kind: body.kind };
    }),
  },
}));
jest.mock("@/services/chatCrypto/mobileKeyStore", () => ({ randomBytesFromDevice: (length: number) => new Uint8Array(length).fill(7) }));
jest.mock("@/services/chatCrypto/chatCrypto.service", () => {
  const actual = jest.requireActual("@/services/chatCrypto/chatCrypto.service");
  return {
    ...actual,
    chatCryptoService: {
      encryptForConversationId: jest.fn(async (_conversationId: string, input: unknown) => {
        encryptedInputs.push(input);
        return { encryption: { deviceId: "d1", ciphertext: "sealed", protocol: "signal-v1" }, linkPreview: null, confirmSent: async () => undefined };
      }),
    },
  };
});
jest.mock("@/store/offline.store", () => ({ runNowOrQueueWhenOffline: jest.fn() }));
jest.mock("@/cache/messageHistory.database", () => ({ messageHistoryStore: { readSavedConversations: () => [] } }));

import { clampLiveUntil, messagesService } from "../messages.service";

beforeEach(() => {
  posted.length = 0;
  encryptedInputs.length = 0;
});

const plaintextKeys = ["text", "location", "poll", "document", "sharedContent"];

describe("encrypted rich chat sends", () => {
  it("puts a location only inside the envelope and caps live locations at 8 hours", async () => {
    const now = new Date();
    const sent = await messagesService.sendLocationToConversation("c1", "liveLocation", { latitude: 6.5, longitude: 3.3, address: "Balogun Market", liveUntil: new Date(now.getTime() + 24 * 3_600_000).toISOString() }, "k");
    const body = posted[0]!.body;
    expect(Object.keys(body).filter((key) => plaintextKeys.includes(key))).toEqual([]);
    expect(JSON.stringify(body)).not.toContain("Balogun");
    const location = (encryptedInputs[0] as { location: { label: string; liveUntil: string } }).location;
    expect(location.label).toBe("Balogun Market");
    expect(Date.parse(location.liveUntil) - now.getTime()).toBeLessThanOrEqual(8 * 3_600_000);
    expect(sent.location?.address).toBe("Balogun Market");
  });

  it("sends polls and votes as ciphertext only", async () => {
    const sent = await messagesService.sendPollToConversation("c1", { question: "Which fabric?", allowMultipleAnswers: false, options: ["Ankara", "Lace"] }, "k");
    expect(JSON.stringify(posted[0]!.body)).not.toContain("Ankara");
    expect(sent.pollDefinition?.options.map((option) => option.text)).toEqual(["Ankara", "Lace"]);
    await messagesService.voteOnPoll("c1", "p1", ["opt"]);
    expect(posted[1]!.body).toMatchObject({ kind: "control" });
    expect(JSON.stringify(posted[1]!.body)).not.toContain("opt");
    expect(encryptedInputs[1]).toMatchObject({ control: { type: "pollVote", targetMessageId: "p1", optionIds: ["opt"] } });
  });

  it("sends reactions and live-location stops as encrypted control messages, never to the old endpoints", async () => {
    await messagesService.setReactionOnMessage("c1", "m1", "🔥", true);
    await messagesService.stopLiveLocation("c1", "l1");
    expect(posted.map((entry) => entry.path)).toEqual(["/api/v1/conversations/c1/messages", "/api/v1/conversations/c1/messages"]);
    expect(JSON.stringify(posted)).not.toContain("🔥");
    expect(encryptedInputs).toEqual([{ text: "", control: { type: "reaction", targetMessageId: "m1", emoji: "🔥", remove: false } }, { text: "", control: { type: "locationStop", targetMessageId: "l1" } }]);
  });

  it("never sends the plaintext document field", async () => {
    await messagesService.sendDocumentToConversation("c1", "media-1", { key: "k".repeat(44), digest: "d".repeat(44), sizeBytes: 10, contentType: "application/pdf", fileName: "Invoice.pdf" }, "k");
    expect(posted[0]!.body).toEqual({ kind: "document", encryption: { deviceId: "d1", ciphertext: "sealed", protocol: "signal-v1" }, mediaId: "media-1" });
  });

  it("clamps any live location request to under 8 hours", () => {
    const now = new Date("2026-10-11T10:00:00.000Z");
    expect(clampLiveUntil("2026-10-12T10:00:00.000Z", now)).toBe("2026-10-11T17:58:00.000Z");
    expect(clampLiveUntil("2026-10-11T10:15:00.000Z", now)).toBe("2026-10-11T10:15:00.000Z");
  });
});
