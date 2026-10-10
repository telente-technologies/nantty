import type { MentionCandidatesResponse, MentionPrivacySettings, MentionSurface, MentionTargetsByUserId } from "@/types/mention.type";

import { api } from "../core/apiClient.service";

export const mentionsService = {
  searchMentionCandidates: (surface: MentionSurface, query: string, conversationId?: string) =>
    api.get<MentionCandidatesResponse>("/api/v1/mentions/candidates", { surface: surface === "direct" ? "group" : surface, q: query, conversationId }),
  resolveMentionTargets: (userIds: readonly string[]) => api.post<MentionTargetsByUserId>("/api/v1/mentions/resolve", { userIds }),
  fetchMyMentionPrivacy: () => api.get<MentionPrivacySettings>("/api/v1/users/me/mention-privacy"),
  updateMyMentionPrivacy: (settings: MentionPrivacySettings) => api.put<MentionPrivacySettings>("/api/v1/users/me/mention-privacy", settings),
};
