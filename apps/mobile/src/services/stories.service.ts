import type { NewPostInput, NewStoryInput, Post, Story, StoryTrayItem } from "@/types";

import { api } from "./api-client.service";

export const storiesService = {
  fetchStoryTray: () => api.get<StoryTrayItem[]>("/api/v1/stories/tray"),
  fetchStoriesForUser: (userId: string) => api.get<Story[]>(`/api/v1/users/${userId}/stories`),
  markStoryAsSeen: (storyId: string) => api.post<void>(`/api/v1/stories/${storyId}/seen`),
  replyToStory: (storyId: string, text: string) => api.post<void>(`/api/v1/stories/${storyId}/replies`, { text }),
  publishStory: (input: NewStoryInput) => api.post<Story>("/api/v1/stories", input),
  publishPost: (input: NewPostInput) => api.post<Post>("/api/v1/posts", input),
};
