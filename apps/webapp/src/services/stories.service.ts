import type { ID, Story, StoryTrayItem, UserSummary } from "@/types";

import { chatCryptoService } from "./chatCrypto/chatCrypto.service";
import { sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";
import { messagesService } from "./messages.service";

export interface StoryViewersPage {
  readonly viewers: readonly UserSummary[];
  readonly total: number;
  readonly nextCursor: string | null;
}

export const storiesService = {
  fetchStoryTray: () => sendListRequestToWebappServer<StoryTrayItem>("/api/v1/stories/tray"),
  fetchStoriesForUser: (userId: ID) => sendListRequestToWebappServer<Story>(`/api/v1/users/${encodeURIComponent(userId)}/stories`),
  markStoryAsSeen: (storyId: ID) => sendRequestToWebappServer<void>(`/api/v1/stories/${encodeURIComponent(storyId)}/seen`, { method: "POST" }),
  replyToStory: async (storyId: ID, authorId: ID, viewerId: ID, text: string) => {
    const conversation = await messagesService.startConversationWithUser(authorId);
    const encrypted = await chatCryptoService.encryptForConversation(conversation, viewerId, {
      text,
      storyId,
      sharedContent: { kind: "story", id: storyId },
    });
    const delivered = await sendRequestToWebappServer<{ readonly id?: ID } | undefined>(
      `/api/v1/stories/${encodeURIComponent(storyId)}/replies`,
      { method: "POST", body: { encryption: encrypted.encryption } },
    );
    await encrypted.confirmSent(delivered?.id ?? null);
  },
  publishStory: (input: { readonly mediaId: ID; readonly soundId?: ID; readonly look?: string }, idempotencyKey: string) =>
    sendRequestToWebappServer<Story>("/api/v1/stories", { method: "POST", body: input, idempotencyKey }),
  fetchStoryViewers: (storyId: ID, cursor?: string | null) =>
    sendRequestToWebappServer<StoryViewersPage>(`/api/v1/stories/${encodeURIComponent(storyId)}/viewers`, { query: { cursor: cursor ?? undefined } }),
};
