import type { HelpArticle } from "@/types/trust.type";

import { api } from "./apiClient.service";

export const helpCenterService = {
  searchHelpArticles: (query: string) => api.get<HelpArticle[]>("/api/v1/help/articles", { q: query || undefined }),
  fetchHelpArticle: (articleId: string) => api.get<HelpArticle>(`/api/v1/help/articles/${encodeURIComponent(articleId)}`),
};
