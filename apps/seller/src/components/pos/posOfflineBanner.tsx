"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { usePosRegisterContext } from "@/hooks/usePosRegisterContext.hook";
import { discardQueuedOfflineSale, retryFailedOfflineSale } from "@/services/posOfflineSaleQueue.service";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./posOfflineBanner.module.css";

export function PosOfflineBanner() {
  const { isOnline, queuedSales, isSyncing, syncQueuedSalesNow, refreshQueuedSales, isCatalogFromCache } = usePosRegisterContext();
  const { formatMoney } = useMoneyFormatter();
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const pendingCount = queuedSales.filter((sale) => sale.status === "queued").length;
  const failedSales = queuedSales.filter((sale) => sale.status === "failed");
  if (isOnline && pendingCount === 0 && failedSales.length === 0) return null;

  return (
    <>
      <div className={`${styles.banner} ${isOnline ? styles.syncing : styles.offline} noPrint`} role="status" aria-live="polite">
        <strong>{isOnline ? (isSyncing ? "Syncing offline sales…" : "Back online") : "You are offline"}</strong>
        <span>
          {isOnline ? "" : "Keep selling — sales are saved on this device and sync when the connection returns. "}
          {pendingCount > 0 ? `${pendingCount} ${pendingCount === 1 ? "sale" : "sales"} waiting to sync.` : ""}
          {isCatalogFromCache && !isOnline ? " Prices and stock are from the last sync." : ""}
        </span>
        <span className={styles.actions}>
          {pendingCount > 0 ? (
            <Button size="small" onClick={() => void syncQueuedSalesNow()} isBusy={isSyncing}>
              Sync now
            </Button>
          ) : null}
          {failedSales.length > 0 ? (
            <Button size="small" variant="danger" onClick={() => setIsReviewOpen(true)}>
              {failedSales.length} need review
            </Button>
          ) : null}
        </span>
      </div>
      <ModalDialog isOpen={isReviewOpen} onClose={() => setIsReviewOpen(false)} title="Sales that could not sync" description="The server refused these offline sales. Retry after fixing the cause, or discard them if they were entered twice." width="large">
        <ul className={styles.failedList}>
          {failedSales.map((queuedSale) => (
            <li key={queuedSale.clientSaleId} className={styles.failedItem}>
              <div>
                <p className={styles.failedTitle}>
                  {formatMoney(queuedSale.localSale.total)} · {queuedSale.localSale.lines.length} lines · {formatDateTimeForDisplay(queuedSale.request.offlineCreatedAt)}
                </p>
                <p className={styles.failedError}>{queuedSale.lastError}</p>
              </div>
              <div className={styles.actions}>
                <Button size="small" onClick={async () => { await retryFailedOfflineSale(queuedSale.clientSaleId); await refreshQueuedSales(); await syncQueuedSalesNow(); }}>
                  Retry
                </Button>
                <Button size="small" variant="ghost" onClick={async () => { if (window.confirm("Discard this offline sale? It will not be recorded.")) { await discardQueuedOfflineSale(queuedSale.clientSaleId); await refreshQueuedSales(); } }}>
                  Discard
                </Button>
              </div>
            </li>
          ))}
          {failedSales.length === 0 ? <li>Nothing to review.</li> : null}
        </ul>
      </ModalDialog>
    </>
  );
}
