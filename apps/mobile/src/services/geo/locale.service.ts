import type { ViewerLocale } from "@/types";
import { useLocaleStore } from "@/store/locale.store";

import { api } from "../core/apiClient.service";

export const localeService = {
  fetchViewerLocaleAndCurrency: () => api.get<ViewerLocale>("/api/v1/locale"),
  async loadViewerLocaleIntoStore(): Promise<void> {
    const locale = await localeService.fetchViewerLocaleAndCurrency();
    useLocaleStore.getState().applyViewerLocaleFromServer(locale);
  },
};
