import type { TagCandidate } from "@/types";

import { api } from "../core/apiClient.service";

export const tagCandidatesService = {
  searchTagCandidates: async (text: string): Promise<readonly TagCandidate[]> =>
    text.trim() ? (await api.get<{ candidates: readonly TagCandidate[] }>("/api/v1/tags/candidates", { q: text.trim() })).candidates : [],
};
