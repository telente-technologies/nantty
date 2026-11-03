import { sendRequestToWebappServer } from "./clientApi.service";

export interface ScheduledPostSummary {
  readonly id: string;
  readonly text: string;
  readonly createdAt: string;
  readonly scheduledAt: string | null;
  readonly status: "scheduled" | "failed";
  readonly failureReason: "media_failed" | "media_processing_timeout" | "author_unavailable" | "profile_unavailable" | null;
  readonly media: readonly { readonly id: string; readonly type: "image" | "video"; readonly status: "processing" | "ready" | "failed"; readonly posterUrl: string | null }[];
}

export interface ScheduledPostsPage {
  readonly data: readonly ScheduledPostSummary[];
  readonly nextCursor: string | null;
}

export const scheduledPostsService = {
  list: (cursor?: string) => sendRequestToWebappServer<ScheduledPostsPage>("/api/v1/posts/scheduled", { query: { cursor, limit: 20 } }),
  reschedule: (postId: string, scheduledAt: string) => sendRequestToWebappServer<{ readonly id: string; readonly scheduledAt: string; readonly status: "scheduled" }>(`/api/v1/posts/${encodeURIComponent(postId)}/schedule`, { method: "PATCH", body: { scheduledAt } }),
  publishNow: (postId: string) => sendRequestToWebappServer<{ readonly id: string; readonly scheduledAt: string; readonly status: "publishing" }>(`/api/v1/posts/${encodeURIComponent(postId)}/schedule/publish-now`, { method: "POST", body: {} }),
  cancel: (postId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${encodeURIComponent(postId)}/schedule`, { method: "DELETE" }),
};
