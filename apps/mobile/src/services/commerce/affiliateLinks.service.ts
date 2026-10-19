import { useSaleAttributionStore } from "@/store/saleAttribution.store";
import type { SaleAttribution } from "@/utils/saleAttribution.util";

import { api } from "../core/apiClient.service";

export interface AffiliateLinkClick {
  readonly productId: string;
  readonly attribution: SaleAttribution;
  readonly attributionWindowDays: number;
  readonly expiresAt: string;
}

export const affiliateLinksService = {
  recordClick: (linkId: string) => api.post<AffiliateLinkClick>(`/api/v1/affiliate-links/${encodeURIComponent(linkId)}/clicks`, { visitorId: useSaleAttributionStore.getState().ensureVisitorId() }),
};
