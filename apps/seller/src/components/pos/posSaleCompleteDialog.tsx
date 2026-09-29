"use client";

import { PosReceiptActions } from "@/components/pos/posReceiptActions";
import { PosReceiptDocument } from "@/components/pos/posReceiptDocument";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { PosSale } from "@/types/pos.type";
import type { StoreSettings } from "@/types/store.type";

import styles from "./posPaymentDialog.module.css";

interface PosSaleCompleteDialogProps {
  readonly sale: PosSale | null;
  readonly isPendingSync: boolean;
  readonly settings: StoreSettings;
  readonly locationName: string | null;
  readonly onStartNewSale: () => void;
}

export function PosSaleCompleteDialog({ sale, isPendingSync, settings, locationName, onStartNewSale }: PosSaleCompleteDialogProps) {
  const { formatMoney } = useMoneyFormatter();
  return (
    <ModalDialog
      isOpen={sale !== null}
      onClose={onStartNewSale}
      title={isPendingSync ? "Sale saved offline" : "Sale complete"}
      description={sale ? `${isPendingSync ? "Will sync when back online" : `Receipt ${sale.receiptNumber}`} · ${formatMoney(sale.total)}` : undefined}
      width="large"
      footer={<Button variant="primary" size="large" autoFocus onClick={onStartNewSale}>Start a new sale</Button>}
    >
      {sale ? (
        <div className={styles.layout}>
          <section className={styles.summary}>
            {sale.changeDue.amountMinor > 0 ? (
              <div className={styles.changeBlock} role="status">
                <span>Give change</span>
                <strong>{formatMoney(sale.changeDue)}</strong>
              </div>
            ) : (
              <Callout tone="success" title="No change due" />
            )}
            {isPendingSync ? <Callout tone="caution">This sale is stored on this device and will get its receipt number when it syncs.</Callout> : null}
            <PosReceiptActions sale={sale} settings={settings} locationName={locationName} isPendingSync={isPendingSync} />
          </section>
          <section style={{ background: "var(--surface-sunken)", borderRadius: 12, padding: 12, maxHeight: "60vh", overflowY: "auto" }}>
            <PosReceiptDocument sale={sale} settings={settings} locationName={locationName} isPendingSync={isPendingSync} />
          </section>
        </div>
      ) : null}
    </ModalDialog>
  );
}
