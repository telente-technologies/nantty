import type { ID, ScheduledPostSummary } from "@/types";

import { api } from "../core/apiClient.service";

export const scheduledPostsService = {
  list: (cursor?: ID) => api.getPage<ScheduledPostSummary>("/api/v1/posts/scheduled", { cursor, limit: 20 }),
  reschedule: (postId: ID, scheduledAt: string) => api.patch<{ readonly id: ID; readonly scheduledAt: string; readonly status: "scheduled" }>(`/api/v1/posts/${postId}/schedule`, { scheduledAt }),
  editContent: (postId: ID, input: { readonly text: string }) => api.patch<ScheduledPostSummary>(`/api/v1/posts/${postId}/schedule/content`, input),
  publishNow: (postId: ID) => api.post<{ readonly id: ID; readonly scheduledAt: string; readonly status: "publishing" }>(`/api/v1/posts/${postId}/schedule/publish-now`, {}),
  cancel: (postId: ID) => api.delete<void>(`/api/v1/posts/${postId}/schedule`),
};
