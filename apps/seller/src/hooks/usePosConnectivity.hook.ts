"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { listQueuedOfflineSales, syncQueuedOfflineSalesInOrder } from "@/services/posOfflineSaleQueue.service";
import type { QueuedOfflineSale } from "@/types/posExtra.type";

const minimumRetryDelayInMilliseconds = 15_000;
const maximumRetryDelayInMilliseconds = 120_000;

export function usePosConnectivity(onSalesSynced: (syncedCount: number) => void) {
  const [isOnline, setIsOnline] = useState(true);
  const [queuedSales, setQueuedSales] = useState<QueuedOfflineSale[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const retryDelayRef = useRef(minimumRetryDelayInMilliseconds);
  const isSyncingRef = useRef(false);
  const onSalesSyncedRef = useRef(onSalesSynced);
  onSalesSyncedRef.current = onSalesSynced;

  const refreshQueuedSales = useCallback(async () => {
    setQueuedSales(await listQueuedOfflineSales());
  }, []);

  const syncQueuedSalesNow = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await syncQueuedOfflineSalesInOrder();
      setIsOnline(!result.stillOffline);
      retryDelayRef.current = result.stillOffline ? Math.min(retryDelayRef.current * 2, maximumRetryDelayInMilliseconds) : minimumRetryDelayInMilliseconds;
      if (result.stillOffline) setRetryTick((tick) => tick + 1);
      if (result.syncedCount > 0) onSalesSyncedRef.current(result.syncedCount);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      await refreshQueuedSales();
    }
  }, [refreshQueuedSales]);

  const reportRequestOutcome = useCallback((wasOffline: boolean) => {
    setIsOnline(!wasOffline);
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    void refreshQueuedSales();
    const markOnlineAndSync = () => {
      setIsOnline(true);
      retryDelayRef.current = minimumRetryDelayInMilliseconds;
      void syncQueuedSalesNow();
    };
    const markOffline = () => setIsOnline(false);
    window.addEventListener("online", markOnlineAndSync);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnlineAndSync);
      window.removeEventListener("offline", markOffline);
    };
  }, [refreshQueuedSales, syncQueuedSalesNow]);

  const pendingCount = queuedSales.filter((sale) => sale.status === "queued").length;
  useEffect(() => {
    if (pendingCount === 0) return;
    const timeoutHandle = window.setTimeout(() => void syncQueuedSalesNow(), isOnline ? 1_000 : retryDelayRef.current);
    return () => window.clearTimeout(timeoutHandle);
  }, [pendingCount, isOnline, retryTick, syncQueuedSalesNow]);

  return { isOnline, queuedSales, isSyncing, refreshQueuedSales, syncQueuedSalesNow, reportRequestOutcome };
}
