import type { HelpCategory, HelpTopicDetail, HelpTopicSummary, HelpVoteResult } from "@/types/helpCentre.type";

import { api } from "../core/apiClient.service";

export const helpCenterService = {
  fetchHelpCategories: () => api.get<{ items: HelpCategory[] }>("/api/v1/help/categories"),
  fetchHelpCategory: (categorySlug: string) => api.get<{ category: HelpCategory; topics: HelpTopicSummary[] }>(`/api/v1/help/categories/${encodeURIComponent(categorySlug)}`),
  searchHelpTopics: (query: string, categorySlug?: string) => api.get<{ items: HelpTopicSummary[] }>("/api/v1/help/topics", { q: query || undefined, category: categorySlug }),
  fetchHelpTopic: (topicSlug: string) => api.get<HelpTopicDetail>(`/api/v1/help/topics/${encodeURIComponent(topicSlug)}`),
  voteOnHelpTopic: (topicId: string, helpful: boolean) => api.post<HelpVoteResult>(`/api/v1/help/topics/${encodeURIComponent(topicId)}/votes`, { helpful }),
};
