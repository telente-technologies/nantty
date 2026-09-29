import { SellerApiRequestError, sendSellerApiRequest } from "@/services/clientApi.service";
import type { CreateSaleRequest, PosSale } from "@/types/pos.type";
import type { QueuedOfflineSale } from "@/types/posExtra.type";
import { deleteRecordFromOfflineStore, posObjectStoreNames, readEveryRecordFromOfflineStore, writeRecordToOfflineStore } from "@/utils/posOfflineDatabase.util";

export type SaleSubmissionOutcome =
  | { readonly kind: "synced"; readonly sale: PosSale }
  | { readonly kind: "queued"; readonly sale: PosSale };

export function isOfflineRequestError(error: unknown): boolean {
  return error instanceof SellerApiRequestError && (error.isNetworkFailure || error.status === 503 || error.status === 502 || error.status === 504);
}

export async function submitPosSaleOrQueueWhenOffline(request: CreateSaleRequest, localSale: PosSale): Promise<SaleSubmissionOutcome> {
  try {
    const sale = await sendSellerApiRequest<PosSale>("/seller/pos/sales", { method: "POST", body: request, idempotencyKey: request.clientSaleId });
    return { kind: "synced", sale };
  } catch (error) {
    if (!isOfflineRequestError(error)) throw error;
    const offlineRequest: CreateSaleRequest = { ...request, offlineCreatedAt: request.offlineCreatedAt ?? new Date().toISOString() };
    const queuedSale: QueuedOfflineSale = { clientSaleId: request.clientSaleId, request: offlineRequest, localSale, queuedAt: new Date().toISOString(), status: "queued", attempts: 0, lastError: null };
    await writeRecordToOfflineStore(posObjectStoreNames.offlineSales, queuedSale);
    return { kind: "queued", sale: localSale };
  }
}

export async function listQueuedOfflineSales(): Promise<QueuedOfflineSale[]> {
  const queuedSales = await readEveryRecordFromOfflineStore<QueuedOfflineSale>(posObjectStoreNames.offlineSales).catch(() => []);
  return queuedSales.sort((first, second) => first.queuedAt.localeCompare(second.queuedAt));
}

export async function discardQueuedOfflineSale(clientSaleId: string): Promise<void> {
  await deleteRecordFromOfflineStore(posObjectStoreNames.offlineSales, clientSaleId);
}

export interface OfflineSyncResult {
  readonly syncedCount: number;
  readonly failedCount: number;
  readonly stillOffline: boolean;
}

export async function syncQueuedOfflineSalesInOrder(): Promise<OfflineSyncResult> {
  const queuedSales = await listQueuedOfflineSales();
  let syncedCount = 0;
  let failedCount = 0;
  for (const queuedSale of queuedSales) {
    if (queuedSale.status === "failed") {
      failedCount += 1;
      continue;
    }
    try {
      await sendSellerApiRequest<PosSale>("/seller/pos/sales", { method: "POST", body: queuedSale.request, idempotencyKey: queuedSale.clientSaleId });
      await deleteRecordFromOfflineStore(posObjectStoreNames.offlineSales, queuedSale.clientSaleId);
      syncedCount += 1;
    } catch (error) {
      if (isOfflineRequestError(error) || (error instanceof SellerApiRequestError && error.status >= 500)) {
        await writeRecordToOfflineStore(posObjectStoreNames.offlineSales, { ...queuedSale, attempts: queuedSale.attempts + 1 });
        return { syncedCount, failedCount, stillOffline: true };
      }
      const message = error instanceof SellerApiRequestError ? error.message : "The sale could not be synced.";
      await writeRecordToOfflineStore(posObjectStoreNames.offlineSales, { ...queuedSale, status: "failed", attempts: queuedSale.attempts + 1, lastError: message });
      failedCount += 1;
    }
  }
  return { syncedCount, failedCount, stillOffline: false };
}

export async function retryFailedOfflineSale(clientSaleId: string): Promise<void> {
  const queuedSale = (await listQueuedOfflineSales()).find((candidate) => candidate.clientSaleId === clientSaleId);
  if (queuedSale) await writeRecordToOfflineStore(posObjectStoreNames.offlineSales, { ...queuedSale, status: "queued", lastError: null });
}
