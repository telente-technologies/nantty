"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { useToast } from "@/components/ui/toastProvider";
import { usePosCatalogLoader } from "@/hooks/usePosCatalogLoader.hook";
import { usePosConnectivity } from "@/hooks/usePosConnectivity.hook";
import { PosRegisterContext, type PosRegisterContextValue } from "@/hooks/usePosRegisterContext.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { sendRequestToDashboardServer } from "@/services/clientApi.service";
import { forgetOfflineOperatorPass, readPosDeviceMemoryForStore, rememberPosDeviceLocation, rememberPosDeviceRegister, type PosDeviceMemory } from "@/services/posDeviceMemory.service";

export const posInactivityLockDelayInMilliseconds = 5 * 60_000;
const lockedFlagStorageKey = "zudomartPosLocked";

function readStoredValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredValue(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    return;
  }
}

export function PosRegisterProvider({ children }: { readonly children: ReactNode }) {
  const { showToast } = useToast();
  const { sessionView, refreshSessionView } = useSellerSession();
  const { selectedLocationId } = useStoreContext();
  const storeId = sessionView?.access.storeId ?? null;
  const [deviceMemory, setDeviceMemory] = useState<PosDeviceMemory | null>(null);
  const locationId = selectedLocationId ?? sessionView?.selectedLocationId ?? deviceMemory?.locationId ?? null;
  const reloadCatalogAfterSyncRef = useRef<() => void>(() => undefined);
  const connectivity = usePosConnectivity((syncedCount) => {
    showToast(`${syncedCount} offline ${syncedCount === 1 ? "sale" : "sales"} synced.`);
    reloadCatalogAfterSyncRef.current();
  });
  const catalogLoader = usePosCatalogLoader(locationId, connectivity.reportRequestOutcome);
  reloadCatalogAfterSyncRef.current = catalogLoader.reloadCatalog;
  const [selectedRegisterId, setSelectedRegisterId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const inactivityTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!storeId) return;
    let isCancelled = false;
    void readPosDeviceMemoryForStore(storeId).then((memory) => {
      if (!isCancelled) setDeviceMemory(memory);
    });
    return () => {
      isCancelled = true;
    };
  }, [storeId]);

  useEffect(() => {
    if (!storeId || !locationId || !deviceMemory || deviceMemory.locationId === locationId) return;
    void rememberPosDeviceLocation(storeId, locationId).then(setDeviceMemory);
  }, [storeId, locationId, deviceMemory]);

  useEffect(() => {
    if (!locationId) return;
    setSelectedRegisterId(deviceMemory?.registerIdByLocationId[locationId] ?? readStoredValue(`zudomartPosRegister:${locationId}`));
  }, [locationId, deviceMemory]);

  useEffect(() => {
    setIsLocked(readStoredValue(lockedFlagStorageKey) === "true");
  }, []);

  const selectRegister = useCallback(
    (registerId: string) => {
      setSelectedRegisterId(registerId);
      if (storeId && locationId) void rememberPosDeviceRegister(storeId, locationId, registerId).then(setDeviceMemory);
    },
    [storeId, locationId],
  );

  const lockRegister = useCallback(async () => {
    writeStoredValue(lockedFlagStorageKey, "true");
    setIsLocked(true);
    if (storeId) await forgetOfflineOperatorPass(storeId);
    await sendRequestToDashboardServer("/bff/session/operator", { method: "DELETE" }).catch(() => undefined);
    await refreshSessionView();
  }, [refreshSessionView, storeId]);

  const markRegisterUnlocked = useCallback(() => {
    writeStoredValue(lockedFlagStorageKey, null);
    setIsLocked(false);
  }, []);

  useEffect(() => {
    if (isLocked || !connectivity.isOnline) return;
    const restartInactivityTimer = () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = window.setTimeout(() => void lockRegister(), posInactivityLockDelayInMilliseconds);
    };
    restartInactivityTimer();
    const activityEvents = ["pointerdown", "keydown"] as const;
    for (const eventName of activityEvents) window.addEventListener(eventName, restartInactivityTimer);
    return () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
      for (const eventName of activityEvents) window.removeEventListener(eventName, restartInactivityTimer);
    };
  }, [isLocked, lockRegister, connectivity.isOnline]);

  const selectedRegister = catalogLoader.registers.find((register) => register.id === selectedRegisterId) ?? null;

  const contextValue = useMemo<PosRegisterContextValue>(
    () => ({
      locationId,
      registers: catalogLoader.registers,
      selectedRegister,
      selectRegister,
      rememberRegisterShift: catalogLoader.rememberRegisterShift,
      reloadRegisters: catalogLoader.reloadCatalog,
      catalog: catalogLoader.catalog,
      isCatalogFromCache: catalogLoader.isCatalogFromCache,
      isCatalogLoading: catalogLoader.isCatalogLoading,
      reloadCatalog: catalogLoader.reloadCatalog,
      applySaleToLocalStock: catalogLoader.applySaleToLocalStock,
      isOnline: connectivity.isOnline,
      reportRequestOutcome: connectivity.reportRequestOutcome,
      queuedSales: connectivity.queuedSales,
      refreshQueuedSales: connectivity.refreshQueuedSales,
      syncQueuedSalesNow: connectivity.syncQueuedSalesNow,
      isSyncing: connectivity.isSyncing,
      isLocked,
      lockRegister,
      markRegisterUnlocked,
    }),
    [locationId, catalogLoader, selectedRegister, selectRegister, connectivity, isLocked, lockRegister, markRegisterUnlocked],
  );
  return <PosRegisterContext.Provider value={contextValue}>{children}</PosRegisterContext.Provider>;
}
