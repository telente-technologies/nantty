import { ApiError } from "@/errors/api.error";
import type { Message, MessagePoll } from "@/types";

import { mockMessagesByConversation } from "./chats.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const replaceMockMessage = (messageId: string, change: (message: Message) => Message): Message => {
  for (const [conversationId, messages] of mockMessagesByConversation) {
    const index = messages.findIndex((message) => message.id === messageId);
    if (index < 0) continue;
    const updated = change(messages[index]!);
    mockMessagesByConversation.set(conversationId, messages.map((message, position) => (position === index ? updated : message)));
    return updated;
  }
  throw new ApiError(404, "Message not found");
};

const withVote = (poll: MessagePoll, optionId: string): MessagePoll => ({
  ...poll,
  options: poll.options.map((option) => {
    const isChosen = option.id === optionId;
    if (isChosen) return { ...option, votedByMe: !option.votedByMe, voteCount: option.voteCount + (option.votedByMe ? -1 : 1) };
    if (!poll.allowMultipleAnswers && option.votedByMe) return { ...option, votedByMe: false, voteCount: option.voteCount - 1 };
    return option;
  }),
});

export const chatAttachmentMocks: MockRoute[] = [
  createMockRoute("PATCH", "/api/v1/messages/:messageId/location", ({ params, body }) => {
    const update = body as { latitude: number; longitude: number; address: string | null };
    return replaceMockMessage(params.messageId!, (message) => {
      const endsAt = message.location?.liveUntil;
      if (message.kind !== "liveLocation" || !endsAt || endsAt <= new Date().toISOString()) throw new ApiError(409, "This live location has ended");
      return { ...message, location: { ...update, liveUntil: endsAt, updatedAt: new Date().toISOString() } };
    });
  }),
  createMockRoute("POST", "/api/v1/messages/:messageId/live-location/stop", ({ params }) =>
    replaceMockMessage(params.messageId!, (message) => (message.location ? { ...message, location: { ...message.location, liveUntil: new Date().toISOString() } } : message)),
  ),
  createMockRoute("POST", "/api/v1/messages/:messageId/poll-votes", ({ params, body }) => {
    const { optionId } = body as { optionId: string };
    const updated = replaceMockMessage(params.messageId!, (message) => {
      if (!message.poll?.options.some((option) => option.id === optionId)) throw new ApiError(404, "Poll option not found");
      return { ...message, poll: withVote(message.poll, optionId) };
    });
    return updated.poll!;
  }),
];
