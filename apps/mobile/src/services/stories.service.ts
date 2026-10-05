import type { NewPostInput, NewStoryInput, Post, Story, StoryTrayItem } from "@/types";

import { api } from "./apiClient.service";
import { chatCryptoService } from "./chatCrypto/chatCrypto.service";

export const storiesService = {
  fetchStoryTray: () => api.getList<StoryTrayItem>("/api/v1/stories/tray"),
  fetchStoriesForUser: (userId: string) => api.getList<Story>(`/api/v1/users/${userId}/stories`),
  markStoryAsSeen: (storyId: string) => api.post<void>(`/api/v1/stories/${storyId}/seen`),
  replyToStory: async (storyId: string, authorId: string, text: string) => {
    const encrypted = await chatCryptoService.encryptForUser(authorId, { text, storyId, sharedContent: { kind: "story", id: storyId } });
    const delivered = await api.post<{ readonly id?: string } | undefined>(`/api/v1/stories/${storyId}/replies`, { encryption: encrypted.encryption });
    await encrypted.confirmSent(delivered?.id ?? null);
  },
  publishStory: (input: NewStoryInput) => api.post<Story>("/api/v1/stories", input),
  publishPost: (input: NewPostInput) => api.post<Post>("/api/v1/posts", input),
};
