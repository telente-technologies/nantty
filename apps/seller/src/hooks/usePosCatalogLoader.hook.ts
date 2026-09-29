"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isOfflineRequestError, listQueuedOfflineSales } from "@/services/posOfflineSaleQueue.service";
import { sendSellerApiRequest } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";
import type { PosSale } from "@/types/pos.type";
import type { PosCatalogSnapshot } from "@/types/posExtra.type";
import type { PosRegister } from "@/types/store.type";
import { posObjectStoreNames, readKeyValueFromOfflineStore, readRecordFromOfflineStore, writeKeyValueToOfflineStore, writeRecordToOfflineStore } from "@/utils/posOfflineDatabase.util";
import { subtractUnsyncedSalesFromCatalogStock } from "@/utils/posOfflineStock.util";

export function usePosCatalogLoader(locationId: string | null, reportRequestOutcome: (wasOffline: boolean) => void) {
  const [catalog, setCatalog] = useState<PosCatalogSnapshot | null>(null);
  const [registers, setRegisters] = useState<PosRegister[]>([]);
  const [isCatalogFromCache, setIsCatalogFromCache] = useState(false);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [reloadCounter, setReloadCounter] = useState(0);
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;

  useEffect(() => {
    if (!locationId) return;
    let isCancelled = false;
    setIsCatalogLoading(true);
    const cachedCatalogPromise = readRecordFromOfflineStore<PosCatalogSnapshot>(posObjectStoreNames.catalogSnapshots, locationId).catch(() => null);
    void cachedCatalogPromise.then((cachedCatalog) => {
      if (!isCancelled && cachedCatalog) setCatalog((current) => current ?? cachedCatalog);
    });
    sendSellerApiRequest<PosCatalogSnapshot>("/seller/pos/catalog", { query: { locationId } })
      .then(async (freshCatalog) => {
        const unsyncedSales = (await listQueuedOfflineSales()).map((queuedSale) => queuedSale.localSale);
        const snapshot = subtractUnsyncedSalesFromCatalogStock({ ...freshCatalog, locationId }, unsyncedSales);
        if (isCancelled) return;
        setCatalog(snapshot);
        setIsCatalogFromCache(false);
        reportRequestOutcome(false);
        await writeRecordToOfflineStore(posObjectStoreNames.catalogSnapshots, snapshot).catch(() => undefined);
      })
      .catch(async (error: unknown) => {
        if (isOfflineRequestError(error)) reportRequestOutcome(true);
        const cachedCatalog = await cachedCatalogPromise;
        if (!isCancelled) {
          setCatalog(cachedCatalog);
          setIsCatalogFromCache(cachedCatalog !== null);
        }
      })
      .finally(() => {
        if (!isCancelled) setIsCatalogLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [locationId, reloadCounter, reportRequestOutcome]);

  useEffect(() => {
    if (!locationId) return;
    let isCancelled = false;
    const registersCacheKey = `registers:${locationId}`;
    sendSellerApiRequest<CursorPage<PosRegister>>("/seller/pos/registers", { query: { locationId } })
      .then(async (page) => {
        if (isCancelled) return;
        setRegisters(page.data);
        await writeKeyValueToOfflineStore(registersCacheKey, page.data);
      })
      .catch(async () => {
        const cachedRegisters = await readKeyValueFromOfflineStore<PosRegister[]>(registersCacheKey);
        if (!isCancelled && cachedRegisters) setRegisters(cachedRegisters);
      });
    return () => {
      isCancelled = true;
    };
  }, [locationId, reloadCounter]);

  const reloadCatalog = useCallback(() => setReloadCounter((counter) => counter + 1), []);

  const rememberRegisterShift = useCallback(
    (registerId: string, shiftId: string | null) => {
      setRegisters((current) => {
        const updated = current.map((register) => (register.id === registerId ? { ...register, openShiftId: shiftId } : register));
        if (locationId) void writeKeyValueToOfflineStore(`registers:${locationId}`, updated);
        return updated;
      });
    },
    [locationId],
  );

  const applySaleToLocalStock = useCallback(async (sale: PosSale) => {
    const currentCatalog = catalogRef.current;
    if (!currentCatalog || currentCatalog.locationId !== sale.locationId) return;
    const updatedCatalog = subtractUnsyncedSalesFromCatalogStock(currentCatalog, [sale]);
    catalogRef.current = updatedCatalog;
    setCatalog(updatedCatalog);
    await writeRecordToOfflineStore(posObjectStoreNames.catalogSnapshots, updatedCatalog).catch(() => undefined);
  }, []);

  return { catalog, registers, isCatalogFromCache, isCatalogLoading, reloadCatalog, rememberRegisterShift, applySaleToLocalStock };
}
