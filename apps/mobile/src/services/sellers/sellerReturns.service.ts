import type { Page } from "@/types/models.type";
import type {
  DeclineSellerReturnInput,
  ReceiveSellerReturnInput,
  SellerReturnRequest,
  SellerReturnStatus,
} from "@/types/sellerReturns.type";

import { api } from "../core/apiClient.service";

const returnPath = (returnId: string) => `/api/v1/seller/returns/${encodeURIComponent(returnId)}`;

export const sellerReturnsService = {
  listStoreReturns: (options: { readonly cursor: string | null; readonly status: SellerReturnStatus | null; readonly limit?: number }): Promise<Page<SellerReturnRequest>> =>
    api.getPage<SellerReturnRequest>("/api/v1/seller/returns", {
      cursor: options.cursor ?? undefined,
      status: options.status ?? undefined,
      limit: options.limit ?? 25,
    }),
  approveStoreReturn: (returnId: string) => api.post<SellerReturnRequest>(`${returnPath(returnId)}/approve`, {}),
  declineStoreReturn: (returnId: string, input: DeclineSellerReturnInput) => api.post<SellerReturnRequest>(`${returnPath(returnId)}/decline`, input),
  receiveStoreReturn: (returnId: string, input: ReceiveSellerReturnInput) => api.post<SellerReturnRequest>(`${returnPath(returnId)}/receive`, input),
};
