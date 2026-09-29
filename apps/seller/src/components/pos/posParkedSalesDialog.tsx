"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";
import type { ParkedSale } from "@/types/pos.type";
import type { LocallyParkedSale, PosCartState } from "@/types/posExtra.type";
import { formatTimeForDisplay } from "@/utils/dateFormatting.util";
import { deleteRecordFromOfflineStore, posObjectStoreNames, readEveryRecordFromOfflineStore } from "@/utils/posOfflineDatabase.util";

import styles from "./posDialogs.module.css";

interface ParkedSaleRow {
  readonly id: string;
  readonly label: string;
  readonly customerName: string | null;
  readonly itemsCount: number;
  readonly totalText: string;
  readonly createdAt: string;
  readonly source: "server" | "device";
  readonly cart: PosCartState;
}

function isParkedCartState(candidate: unknown): candidate is PosCartState {
  return typeof candidate === "object" && candidate !== null && Array.isArray((candidate as PosCartState).lines) && typeof (candidate as PosCartState).clientSaleId === "string";
}

export function PosParkedSalesDialog({ isOpen, registerId, onRecall, onClose }: { readonly isOpen: boolean; readonly registerId: string | null; readonly onRecall: (cart: PosCartState) => void; readonly onClose: () => void }) {
  const { formatMoney } = useMoneyFormatter();
  const [rows, setRows] = useState<ParkedSaleRow[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !registerId) return;
    setRows(null);
    setErrorMessage(null);
    const serverRowsPromise = sendSellerApiRequest<CursorPage<ParkedSale>>("/seller/pos/parked-sales", { query: { registerId } })
      .then((page) => page.data.filter((sale) => isParkedCartState(sale.cart)).map((sale): ParkedSaleRow => ({ id: sale.id, label: sale.label, customerName: sale.customerName, itemsCount: sale.itemsCount, totalText: formatMoney(sale.total), createdAt: sale.createdAt, source: "server", cart: sale.cart as PosCartState })))
      .catch(() => {
        setErrorMessage("Parked sales from other devices are not available offline.");
        return [] as ParkedSaleRow[];
      });
    const deviceRowsPromise = readEveryRecordFromOfflineStore<LocallyParkedSale>(posObjectStoreNames.parkedSales)
      .then((sales) => sales.filter((sale) => sale.registerId === registerId).map((sale): ParkedSaleRow => ({ id: sale.id, label: sale.label, customerName: sale.customerName, itemsCount: sale.itemsCount, totalText: formatMoney(sale.total), createdAt: sale.createdAt, source: "device", cart: sale.cart })))
      .catch(() => [] as ParkedSaleRow[]);
    void Promise.all([serverRowsPromise, deviceRowsPromise]).then(([serverRows, deviceRows]) => setRows([...deviceRows, ...serverRows].sort((first, second) => second.createdAt.localeCompare(first.createdAt))));
  }, [isOpen, registerId, formatMoney]);

  async function recallParkedSale(row: ParkedSaleRow) {
    try {
      if (row.source === "server") await sendSellerApiRequest(`/seller/pos/parked-sales/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      else await deleteRecordFromOfflineStore(posObjectStoreNames.parkedSales, row.id);
      onRecall(row.cart);
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    }
  }

  return (
    <ModalDialog isOpen={isOpen} onClose={onClose} title="Parked sales" description="Recall a held sale to finish it." width="medium">
      {errorMessage ? <Callout tone="caution">{errorMessage}</Callout> : null}
      {rows === null ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="No parked sales" description="Press F8 during a sale to hold it here." /> : (
        <ul className={styles.resultList}>
          {rows.map((row) => (
            <li key={row.id}>
              <div className={styles.resultButton}>
                <span>
                  <strong>{row.label}</strong>
                  <br />
                  <span className={styles.resultSecondary}>
                    {row.itemsCount} items · {row.totalText} · {formatTimeForDisplay(row.createdAt)}
                    {row.source === "device" ? " · saved on this device" : ""}
                  </span>
                </span>
                <Button size="small" variant="primary" onClick={() => void recallParkedSale(row)}>Recall</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ModalDialog>
  );
}
