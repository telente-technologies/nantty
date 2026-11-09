import type { Page, SavedItem, SavedItemFilter, SaveTarget } from "@/types";

import { api } from "../core/apiClient.service";

export const savesService = {
  saveItem: (target: SaveTarget) => api.post<void>("/api/v1/saves", target),
  unsaveItem: (target: SaveTarget) => api.delete<void>("/api/v1/saves", { query: { type: target.type, targetId: target.targetId } }),
  fetchSaveStatus: (target: SaveTarget) => api.get<{ readonly isSaved: boolean }>("/api/v1/saves/status", { type: target.type, targetId: target.targetId }),
  fetchSavedItemsPage: async (filter: SavedItemFilter, cursor: string | null): Promise<Page<SavedItem>> => {
    const page = await api.get<Page<SavedItem>>("/api/v1/saves", { type: filter === "all" ? undefined : filter, cursor: cursor ?? undefined });
    return { ...page, data: page.data.filter((item) => item.type !== "product" || !!item.product) };
  },
};
