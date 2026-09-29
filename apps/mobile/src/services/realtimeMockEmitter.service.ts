import { appendMockMessageAndUpdateConversation, findMockConversation, mockChatUser } from "@/mocks/chats.mock";
import type { RealtimeServerEvent } from "@/types";

const MOCK_INCOMING_MESSAGE_INTERVAL_MS = 45_000;
const MOCK_TYPING_DURATION_MS = 2_500;
const MOCK_INCOMING_TEXTS = [
  "Did you see the photos I sent? 😍",
  "The tailor just called, dress is ready!",
  "Abeg what time are we meeting on Saturday?",
  "I don transfer the balance, check am",
  "Lol this group chat is too sweet 😂",
];

export function startMockRealtimeEventEmitter(emit: (event: RealtimeServerEvent) => void) {
  let incomingMessageIndex = 0;
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  const sendTypingThenIncomingMessage = () => {
    const conversationId = incomingMessageIndex % 2 === 0 ? "c_1" : "g_owambe";
    const sender = mockChatUser(conversationId === "c_1" ? "u_21" : "u_13");
    emit({ type: "typing", conversationId, user: sender, isTyping: true });
    typingTimer = setTimeout(() => {
      emit({ type: "typing", conversationId, user: sender, isTyping: false });
      const message = appendMockMessageAndUpdateConversation({
        id: `m_live_${Date.now()}`,
        conversationId,
        senderId: sender.id,
        sender,
        text: MOCK_INCOMING_TEXTS[incomingMessageIndex % MOCK_INCOMING_TEXTS.length]!,
        createdAt: new Date().toISOString(),
        kind: "text",
      });
      incomingMessageIndex += 1;
      emit({ type: "message.created", message });
      emit({ type: "conversation.updated", conversation: findMockConversation(conversationId) });
    }, MOCK_TYPING_DURATION_MS);
  };
  const interval = setInterval(sendTypingThenIncomingMessage, MOCK_INCOMING_MESSAGE_INTERVAL_MS);
  return () => {
    clearInterval(interval);
    if (typingTimer) clearTimeout(typingTimer);
  };
}
