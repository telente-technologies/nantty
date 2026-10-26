const requests: { method: string; path: string; body?: unknown }[] = [];
const encryptTargets: unknown[] = [];
const openedAttributes = { current: null as unknown };

jest.mock("@/services/core/apiClient.service", () => ({
  ApiError: class extends Error {},
  generateIdempotencyKey: () => "key",
  api: {
    get: jest.fn(async (path: string) => {
      requests.push({ method: "GET", path });
      return path.endsWith("/recipients") ? { userIds: ["buyer", "staff-1", "staff-2"], storeTeamUserIds: ["staff-1", "staff-2"] } : {};
    }),
    post: jest.fn(async (path: string, body?: unknown) => {
      requests.push({ method: "POST", path, body });
      return { id: "biz-1", kind: "business", peer: { id: "biz-1", name: "" } };
    }),
  },
}));
jest.mock("@/services/chatCrypto/mobileKeyStore", () => ({ randomBytesFromDevice: (length: number) => new Uint8Array(length).fill(3), createMobileChatCryptoStorage: () => ({}) }));
jest.mock("@/store/auth.store", () => ({ registerSignOutHook: () => undefined, useAuthStore: { getState: () => ({ user: { id: "buyer" } }) } }));
jest.mock("@nantty/chat-crypto", () => {
  const actual = jest.requireActual("@nantty/chat-crypto");
  return {
    ...actual,
    ChatCryptoClient: class {
      ensureReady = async () => undefined;
      encryptMessage = async (target: unknown) => {
        encryptTargets.push(target);
        return { encryption: { deviceId: "d", ciphertext: "sealed", protocol: "signal-v1" }, linkPreview: null, confirmSent: async () => undefined };
      };
      openGroupAttributes = async () => openedAttributes.current;
    },
  };
});
const decrypted: string[] = [];
jest.mock("@/services/chatCrypto/encryptedAttachments.service", () => ({
  resolveDecryptedImageInMemory: jest.fn(async (mediaId: string) => {
    decrypted.push(mediaId);
    return `data:image/jpeg;base64,${mediaId}`;
  }),
}));

import { asSeenFromStoreChat, describeConversationForDisplay } from "@/components/chat/conversationDisplay.util";
import { chatCryptoService } from "@/services/chatCrypto/chatCrypto.service";
import type { Conversation } from "@/types";

import { selectVerifiedGroupAvatar, withDecryptedGroupDetails } from "../groupDetails.service";

const pointer = { key: "k".repeat(44), digest: "d".repeat(44), sizeBytes: 10, contentType: "image/jpeg" };

beforeEach(() => {
  requests.length = 0;
  encryptTargets.length = 0;
  decrypted.length = 0;
});

describe("store chats", () => {
  it("encrypts a store chat as a sender-key group for the customer and every team member", async () => {
    const conversation = { id: "biz-1", kind: "business", peer: { id: "biz-1", name: "" } } as unknown as Conversation;
    await chatCryptoService.encryptForConversation(conversation, { text: "Is the Ankara in stock?" });
    expect(requests.map((request) => request.path)).toContain("/api/v1/conversations/biz-1/recipients");
    expect(encryptTargets[0]).toEqual({ kind: "group", conversationId: "biz-1", memberUserIds: ["buyer", "staff-1", "staff-2"] });
    expect(requests.some((request) => request.path.includes("/conversations/stores/") && request.path.endsWith("/messages"))).toBe(false);
  });

  it("shows the store, not a staff member, as the chat name, avatar and sender", () => {
    expect(describeConversationForDisplay({ id: "biz-1", kind: "business", peer: { id: "biz-1", name: "" }, store: null } as unknown as Conversation).displayName).toBe("Store");
    const storeChat = { id: "biz-1", kind: "business", peer: { id: "st", name: "Ada Fabrics", avatarUrl: null }, store: { id: "st", name: "Ada Fabrics", avatarUrl: "https://cdn/logo.png" } } as unknown as Conversation;
    expect(describeConversationForDisplay(storeChat)).toMatchObject({ displayName: "Ada Fabrics", avatarUrl: "https://cdn/logo.png", isBusiness: true });
    const fromStaff = asSeenFromStoreChat({ id: "m1", senderId: "staff-1", sender: { id: "staff-1", name: "Tolu Personal", avatarUrl: "https://cdn/tolu.png" } } as never, storeChat, "buyer") as { sender: { name: string; avatarUrl: string } };
    expect(fromStaff.sender).toMatchObject({ name: "Ada Fabrics", avatarUrl: "https://cdn/logo.png" });
    const mine = { id: "m2", senderId: "buyer" };
    expect(asSeenFromStoreChat(mine as never, storeChat, "buyer")).toBe(mine);
  });
});

describe("encrypted group photos", () => {
  const group = { id: "g1", kind: "group", peer: { id: "g1", name: "" }, encryptedAttributes: "sealed", photoMediaId: "m-photo", photoUrl: "https://media/signed" } as unknown as Conversation;

  it("decrypts the photo only when the sealed avatar names the same media id", async () => {
    openedAttributes.current = { title: "Lagos crew", description: null, avatar: { mediaId: "m-photo", pointer } };
    expect((await withDecryptedGroupDetails(group)).photoUrl).toBe("data:image/jpeg;base64,m-photo");
    openedAttributes.current = { title: "Lagos crew", description: null, avatar: { mediaId: "m-other", pointer } };
    const swapped = await withDecryptedGroupDetails(group);
    expect(swapped.photoUrl).toBeNull();
    expect(decrypted).toEqual(["m-photo"]);
  });

  it("never shows the encrypted blob URL itself", async () => {
    openedAttributes.current = null;
    expect((await withDecryptedGroupDetails(group)).photoUrl).toBeNull();
    expect(selectVerifiedGroupAvatar(group, { title: "x", description: null, avatar: { mediaId: "m-photo", pointer: { ...pointer, contentType: "text/html" } } })).toBeNull();
  });
});
