import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

import type { LocallyStoredMessage } from "@/cache/messageHistory.type";

import { foldConversationMessages } from "../chatControlFold.util";
import { useMessageReactionToggle } from "../messageReactions.hook";

const mockSendChatControl = jest.fn();
const mockShowToast = jest.fn();
const mockSaveDelivered = jest.fn();

jest.mock("@/services/chat/messages.service", () => ({ sendChatControl: (...args: unknown[]) => mockSendChatControl(...args) }));
jest.mock("@/services/core/apiClient.service", () => ({ generateIdempotencyKey: () => `k${Math.random()}` }));
jest.mock("@/store/toast.store", () => ({ showToast: (...args: unknown[]) => mockShowToast(...args) }));
jest.mock("@/store/auth.store", () => ({ registerSignOutHook: () => undefined, useAuthStore: (select: (state: { user: { id: string } }) => unknown) => select({ user: { id: "me" } }) }));
jest.mock("@/cache/messageHistory.database", () => ({ messageHistoryStore: { saveDeliveredMessages: (...args: unknown[]) => mockSaveDelivered(...args) } }));

const target: LocallyStoredMessage = { id: "m1", conversationId: "c1", senderId: "ada", text: "hi", kind: "text", createdAt: "2026-10-11T10:00:00.000Z", deliveryStatus: "sent", reactions: [] };

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
const cached = () => client.getQueryData<LocallyStoredMessage[]>(["messages", "c1"]) ?? [];
const reactionsOnTarget = () => foldConversationMessages(cached(), "me").visibleMessages[0]?.reactions;

beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient();
  client.setQueryData(["messages", "c1"], [target]);
});
afterEach(() => client.clear());

describe("encrypted reaction toggle", () => {
  it("shows the reaction at once, then keeps the delivered control message", async () => {
    let resolveSend: (value: unknown) => void = () => undefined;
    mockSendChatControl.mockReturnValue(new Promise((resolve) => (resolveSend = resolve)));
    const { result } = await renderHook(() => useMessageReactionToggle("c1"), { wrapper });
    let pending: Promise<void> = Promise.resolve();
    await act(async () => {
      pending = result.current(target, "🔥", true);
      await Promise.resolve();
    });
    expect(reactionsOnTarget()).toEqual([{ emoji: "🔥", count: 1, reactedByMe: true }]);
    await act(async () => {
      resolveSend({ id: "srv-1", conversationId: "c1", senderId: "me", text: "", kind: "control", createdAt: "2026-10-11T10:01:00.000Z" });
      await pending;
    });
    expect(cached().map((message) => message.id)).toEqual(["m1", "srv-1"]);
    expect(reactionsOnTarget()).toEqual([{ emoji: "🔥", count: 1, reactedByMe: true }]);
    expect(mockSendChatControl).toHaveBeenCalledWith("c1", { type: "reaction", targetMessageId: "m1", emoji: "🔥", remove: false });
  });

  it("rolls back and tells the person when sending fails", async () => {
    mockSendChatControl.mockRejectedValue(new Error("offline"));
    const { result } = await renderHook(() => useMessageReactionToggle("c1"), { wrapper });
    await act(async () => {
      await result.current(target, "🔥", true);
    });
    expect(cached()).toEqual([target]);
    expect(reactionsOnTarget()).toEqual([]);
    expect(mockShowToast).toHaveBeenCalledWith("Couldn't update your reaction", { tone: "error" });
  });

  it("does nothing for undelivered messages", async () => {
    const { result } = await renderHook(() => useMessageReactionToggle("c1"), { wrapper });
    await act(async () => {
      await result.current({ ...target, deliveryStatus: "pending" }, "🔥", true);
    });
    expect(mockSendChatControl).not.toHaveBeenCalled();
  });
});
