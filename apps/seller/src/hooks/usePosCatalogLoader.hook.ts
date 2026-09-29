"use client";

import { useCallback, useEffect, useState } from "react";

import { isOfflineRequestError } from "@/services/posOfflineSaleQueue.service";
import { sendSellerApiRequest } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";
import type { PosCatalogSnapshot } from "@/types/posExtra.type";
import type { PosRegister } from "@/types/store.type";
import { posObjectStoreNames, readKeyValueFromOfflineStore, readRecordFromOfflineStore, writeKeyValueToOfflineStore, writeRecordToOfflineStore } from "@/utils/posOfflineDatabase.util";

export function usePosCatalogLoader(locationId: string | null, reportRequestOutcome: (wasOffline: boolean) => void) {
  const [catalog, setCatalog] = useState<PosCatalogSnapshot | null>(null);
  const [registers, setRegisters] = useState<PosRegister[]>([]);
  const [isCatalogFromCache, setIsCatalogFromCache] = useState(false);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [reloadCounter, setReloadCounter] = useState(0);

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
        const snapshot = { ...freshCatalog, locationId };
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

  return { catalog, registers, isCatalogFromCache, isCatalogLoading, reloadCatalog, rememberRegisterShift };
}
