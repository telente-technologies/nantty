import type { SaleAttribution } from "@/utils/saleAttribution.util";

import { sendRequestToWebappServer } from "./clientApi.service";

export interface AffiliateLinkClick {
  readonly productId: string;
  readonly attribution: SaleAttribution;
  readonly attributionWindowDays: number;
  readonly expiresAt: string;
}

export const affiliateLinksService = {
  recordClick: (linkId: string) => sendRequestToWebappServer<AffiliateLinkClick>(`/api/v1/affiliate-links/${encodeURIComponent(linkId)}/clicks`, { method: "POST" }),
};
