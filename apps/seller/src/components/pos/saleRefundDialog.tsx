"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { CheckboxField, SelectField, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { createIdempotencyKey, readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { PosSale, SaleRefund } from "@/types/pos.type";
import type { PaymentMethod, PaymentMethodSetting } from "@/types/store.type";

import styles from "./posDialogs.module.css";

interface RefundLineDraft {
  readonly quantity: number;
  readonly restock: boolean;
}

export function SaleRefundDialog({ sale, isOpen, paymentMethods, onRefunded, onClose }: { readonly sale: PosSale; readonly isOpen: boolean; readonly paymentMethods: PaymentMethodSetting[]; readonly onRefunded: (refund: SaleRefund) => void; readonly onClose: () => void }) {
  const { formatMoney } = useMoneyFormatter();
  const [lineDrafts, setLineDrafts] = useState<Record<string, RefundLineDraft>>({});
  const [kind, setKind] = useState<"refund" | "exchange">("refund");
  const [method, setMethod] = useState<PaymentMethod>(sale.payments[0]?.method ?? "cash");
  const [reason, setReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey("refund"));
  const enabledMethods = paymentMethods.filter((setting) => setting.enabled && setting.method !== "pay_link");

  useEffect(() => {
    if (!isOpen) return;
    setLineDrafts({});
    setReason("");
    setErrorMessage(null);
    setIdempotencyKey(createIdempotencyKey("refund"));
  }, [isOpen]);

  const refundableLines = sale.lines.filter((line) => line.quantity - line.refundedQuantity > 0);
  const refundTotalMinor = refundableLines.reduce((sum, line) => {
    const quantity = lineDrafts[line.id]?.quantity ?? 0;
    return sum + Math.round((line.lineTotal.amountMinor * quantity) / line.quantity);
  }, 0);

  async function submitRefund() {
    const lines = refundableLines.flatMap((line) => {
      const draft = lineDrafts[line.id];
      return draft && draft.quantity > 0 ? [{ saleLineId: line.id, quantity: draft.quantity, restock: draft.restock }] : [];
    });
    if (lines.length === 0) return setErrorMessage("Choose at least one item and quantity to refund.");
    if (reason.trim().length < 3) return setErrorMessage("Give a reason (at least 3 characters).");
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const refund = await sendSellerApiRequest<SaleRefund>(`/seller/pos/sales/${encodeURIComponent(sale.id)}/refunds`, { method: "POST", idempotencyKey, body: { kind, method, reason: reason.trim(), lines } });
      onRefunded(refund);
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Refund or exchange · ${sale.receiptNumber}`}
      width="large"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" isBusy={isSaving} onClick={() => void submitRefund()} disabled={refundTotalMinor <= 0}>
            {kind === "exchange" ? "Refund and start exchange" : "Refund"} {formatMoney({ amountMinor: refundTotalMinor, currency: sale.total.currency })}
          </Button>
        </>
      }
    >
      <form className={styles.formStack} onSubmit={(event) => { event.preventDefault(); void submitRefund(); }}>
        {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
        <SegmentedControl label="Refund type" value={kind} onValueChange={setKind} options={[{ value: "refund", label: "Refund" }, { value: "exchange", label: "Exchange" }]} />
        <ul className={styles.resultList}>
          {refundableLines.map((line) => {
            const remaining = line.quantity - line.refundedQuantity;
            const draft = lineDrafts[line.id] ?? { quantity: 0, restock: true };
            return (
              <li key={line.id} className={styles.resultButton}>
                <span>
                  <strong>{line.name}</strong>
                  <br />
                  <span className={styles.resultSecondary}>{line.variantTitle} · {remaining} of {line.quantity} can be refunded · {formatMoney(line.lineTotal)}</span>
                </span>
                <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <SelectField label={`Quantity of ${line.name} to refund`} hideLabel value={String(draft.quantity)} onChange={(event) => setLineDrafts({ ...lineDrafts, [line.id]: { ...draft, quantity: Number(event.target.value) } })} options={Array.from({ length: remaining + 1 }, (_, quantity) => ({ value: String(quantity), label: String(quantity) }))} />
                  <CheckboxField label="Back to stock" checked={draft.restock} onCheckedChange={(restock) => setLineDrafts({ ...lineDrafts, [line.id]: { ...draft, restock } })} />
                </span>
              </li>
            );
          })}
        </ul>
        <div className={styles.formRow}>
          <SelectField label="Refund to" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} options={enabledMethods.map((setting) => ({ value: setting.method, label: setting.label }))} />
          <TextField label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder="For example: wrong size" />
        </div>
        {kind === "exchange" ? <Callout tone="info">After the refund, the register opens so you can ring up the replacement items.</Callout> : null}
      </form>
    </ModalDialog>
  );
}
