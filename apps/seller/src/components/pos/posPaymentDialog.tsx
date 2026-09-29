"use client";

import { useCallback, useEffect, useState } from "react";

import { PosPayLinkPanel } from "@/components/pos/posPayLinkPanel";
import { Button, IconButton } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { MoneyField, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { createIdempotencyKey } from "@/services/clientApi.service";
import type { CurrencyCode } from "@/types/money.type";
import type { PendingPayment, PosPayLink } from "@/types/posExtra.type";
import type { PaymentMethod, PaymentMethodSetting } from "@/types/store.type";
import { convertMajorInputToMinorUnits, convertMinorUnitsToMajorInputText } from "@/utils/money.util";
import { buildQuickTenderAmountsMinor } from "@/utils/posTender.util";
import { receiptPaymentMethodLabels } from "@/utils/receiptText.util";

import styles from "./posPaymentDialog.module.css";

interface PosPaymentDialogProps {
  readonly isOpen: boolean;
  readonly totalMinor: number;
  readonly currency: CurrencyCode;
  readonly paymentMethods: PaymentMethodSetting[];
  readonly clientSaleId: string;
  readonly isOnline: boolean;
  readonly isCompleting: boolean;
  readonly onComplete: (payments: PendingPayment[]) => void;
  readonly onClose: () => void;
}

const onlineOnlyMethods = new Set<PaymentMethod>(["zudomart_wallet", "pay_link"]);

export function PosPaymentDialog({ isOpen, totalMinor, currency, paymentMethods, clientSaleId, isOnline, isCompleting, onComplete, onClose }: PosPaymentDialogProps) {
  const { formatMoney } = useMoneyFormatter();
  const money = (amountMinor: number) => formatMoney({ amountMinor, currency });
  const enabledMethods = paymentMethods.filter((setting) => setting.enabled);
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amountText, setAmountText] = useState("");
  const [reference, setReference] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const paidMinor = payments.reduce((sum, payment) => sum + payment.amountMinor, 0);
  const remainingMinor = Math.max(0, totalMinor - paidMinor);
  const changeMinor = payments.reduce((sum, payment) => sum + (payment.tenderedMinor !== null ? payment.tenderedMinor - payment.amountMinor : 0), 0);
  const methodSetting = enabledMethods.find((setting) => setting.method === method);

  useEffect(() => {
    if (!isOpen) return;
    setPayments([]);
    setMethod(enabledMethods[0]?.method ?? "cash");
    setErrorMessage(null);
    setReference("");
    setAmountText(convertMinorUnitsToMajorInputText(totalMinor, currency));
  }, [isOpen]);

  useEffect(() => {
    setAmountText(remainingMinor > 0 ? convertMinorUnitsToMajorInputText(remainingMinor, currency) : "");
  }, [remainingMinor, currency]);

  function addPayment(amountMinorOverride?: number) {
    const enteredMinor = amountMinorOverride ?? convertMajorInputToMinorUnits(amountText, currency);
    if (!enteredMinor || enteredMinor <= 0) {
      setErrorMessage("Enter an amount above zero.");
      return;
    }
    if (method !== "cash" && enteredMinor > remainingMinor) {
      setErrorMessage(`Only ${money(remainingMinor)} is left to pay. Only cash can be more than the amount due.`);
      return;
    }
    if (method === "card" && reference.trim() && !/^[A-Za-z0-9-]{3,40}$/.test(reference.trim())) {
      setErrorMessage("The approval code should be 3–40 letters or numbers.");
      return;
    }
    const appliedMinor = Math.min(enteredMinor, remainingMinor);
    setPayments((current) => [...current, { id: createIdempotencyKey("pay"), method, amountMinor: appliedMinor, tenderedMinor: method === "cash" ? enteredMinor : null, reference: reference.trim() || null }]);
    setReference("");
    setErrorMessage(null);
  }

  const addPaidPayLink = useCallback((payLink: PosPayLink) => {
    setPayments((current) => (current.some((payment) => payment.reference === payLink.reference) ? current : [...current, { id: createIdempotencyKey("pay"), method: "pay_link", amountMinor: payLink.amount.amountMinor, tenderedMinor: null, reference: payLink.reference }]));
  }, []);

  const amountToCollectMinor = convertMajorInputToMinorUnits(amountText, currency) ?? 0;

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Take payment"
      width="large"
      footer={
        <>
          <Button onClick={onClose} disabled={isCompleting}>Back to sale</Button>
          <Button variant="primary" size="large" disabled={remainingMinor > 0 || payments.length === 0} isBusy={isCompleting} onClick={() => onComplete(payments)}>
            Complete sale
          </Button>
        </>
      }
    >
      <div className={styles.layout}>
        <section className={styles.summary} aria-live="polite">
          <div className={styles.dueBlock}>
            <span>{remainingMinor > 0 ? "Left to pay" : "Paid in full"}</span>
            <strong className={styles.dueAmount}>{money(remainingMinor)}</strong>
            <span className={styles.muted}>of {money(totalMinor)}</span>
          </div>
          {changeMinor > 0 ? (
            <div className={styles.changeBlock}>
              <span>Change due</span>
              <strong>{money(changeMinor)}</strong>
            </div>
          ) : null}
          <ul className={styles.paymentList} aria-label="Payments added">
            {payments.map((payment) => (
              <li key={payment.id}>
                <span>{receiptPaymentMethodLabels[payment.method]}{payment.reference ? ` · ${payment.reference}` : ""}</span>
                <span className={styles.amount}>{money(payment.tenderedMinor ?? payment.amountMinor)}</span>
                <IconButton iconName="trash24" size="small" label={`Remove ${receiptPaymentMethodLabels[payment.method]} payment`} onClick={() => setPayments((current) => current.filter((candidate) => candidate.id !== payment.id))} />
              </li>
            ))}
          </ul>
        </section>
        {remainingMinor > 0 ? (
          <section className={styles.entry}>
            <div className={styles.methods} role="radiogroup" aria-label="Payment method">
              {enabledMethods.map((setting) => {
                const isUnavailableOffline = !isOnline && onlineOnlyMethods.has(setting.method);
                return (
                  <button key={setting.method} type="button" role="radio" aria-checked={method === setting.method} disabled={isUnavailableOffline} className={styles.methodButton} onClick={() => { setMethod(setting.method); setErrorMessage(null); }}>
                    {setting.label}
                    {isUnavailableOffline ? <span className={styles.muted}>Needs connection</span> : null}
                  </button>
                );
              })}
            </div>
            {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
            {methodSetting?.instructions ? <Callout tone="info">{methodSetting.instructions}</Callout> : null}
            {onlineOnlyMethods.has(method) ? (
              <PosPayLinkPanel key={`${clientSaleId}-${remainingMinor}`} amountMinor={remainingMinor} clientSaleId={clientSaleId} onPaid={addPaidPayLink} />
            ) : (
              <form className={styles.entryForm} onSubmit={(event) => { event.preventDefault(); addPayment(); }}>
                <MoneyField label={method === "cash" ? "Cash received" : "Amount"} currency={currency} valueText={amountText} onValueTextChange={setAmountText} />
                {method === "cash" ? (
                  <div className={styles.quickTender} role="group" aria-label="Quick cash amounts">
                    {buildQuickTenderAmountsMinor(remainingMinor, currency).map((quickAmountMinor) => (
                      <button key={quickAmountMinor} type="button" className={styles.quickTenderButton} onClick={() => addPayment(quickAmountMinor)}>
                        {money(quickAmountMinor)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <TextField label={method === "card" ? "Terminal approval code" : "Transfer reference"} value={reference} onChange={(event) => setReference(event.target.value)} maxLength={40} hint="Optional, but it helps when reconciling." />
                )}
                {method === "cash" && amountToCollectMinor > remainingMinor ? <p className={styles.changePreview}>Change: {money(amountToCollectMinor - remainingMinor)}</p> : null}
                <Button type="submit" variant={method === "cash" ? "tender" : "primary"} size="large">
                  Add {receiptPaymentMethodLabels[method].toLowerCase()} payment
                </Button>
              </form>
            )}
          </section>
        ) : (
          <section className={styles.entry}>
            <Callout tone="success" title="Ready to complete">Press Complete sale to finish and print the receipt.</Callout>
          </section>
        )}
      </div>
    </ModalDialog>
  );
}
