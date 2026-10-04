import type { TagCandidate } from "@/types";

import { api } from "./apiClient.service";

export const tagCandidatesService = {
  searchTagCandidates: async (text: string): Promise<readonly TagCandidate[]> =>
    (await api.get<{ candidates: readonly TagCandidate[] }>("/api/v1/tags/candidates", { q: text })).candidates,
};
