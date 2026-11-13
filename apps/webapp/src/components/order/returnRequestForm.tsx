"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { CartItem, ReturnRequestInput, ReturnRequestView } from "@/types";
import {
  activeReturnForOrder,
  maxReturnQuantity,
  RETURN_LINE_MAX_COUNT,
  RETURN_REASON_MAX_LENGTH,
  toReturnRequestInput,
  validateReturnDraft,
} from "@/utils/returnRequests.util";

import styles from "./returnRequestForm.module.css";

interface ReturnRequestFormProps {
  readonly items: readonly CartItem[];
  readonly knownRequest?: ReturnRequestView;
  readonly submittedRequest?: ReturnRequestView;
  readonly submitting: boolean;
  readonly errorMessage?: string | null;
  readonly onSubmit: (input: ReturnRequestInput) => void;
}

const statusLabel = (status: string) => status.replaceAll("_", " ");

export function ReturnRequestForm({ items, knownRequest, submittedRequest, submitting, errorMessage, onSubmit }: ReturnRequestFormProps) {
  const [quantities, setQuantities] = useState<Readonly<Record<string, number>>>({});
  const [reason, setReason] = useState("");
  const activeRequest = knownRequest && activeReturnForOrder(knownRequest.status) ? knownRequest : undefined;
  const validationMessage = validateReturnDraft(items, quantities, reason);
  const selectedLineCount = items.filter((item) => (quantities[item.id] ?? 0) > 0).length;

  function changeQuantity(item: CartItem, next: number) {
    setQuantities((current) => ({ ...current, [item.id]: Math.max(0, Math.min(maxReturnQuantity(item), next)) }));
  }

  return (
    <section className={styles.card} aria-labelledby="return-request-title">
      <h2 className={styles.title} id="return-request-title">Request a return</h2>
      <p className={styles.copy}>Select the items and quantities you want to return. Nantty will record your request for the seller to review.</p>

      {submittedRequest ? (
        <div className={styles.notice} role="status">
          <strong>Return request submitted</strong>
          <span>Status: {statusLabel(submittedRequest.status)}. The seller will review your request.</span>
        </div>
      ) : activeRequest ? (
        <div className={styles.notice} role="status">
          <strong>Return request {statusLabel(activeRequest.status)}</strong>
          <span>A request is already on file for this order.</span>
        </div>
      ) : (
        <>
          {knownRequest ? <p className={styles.copy}>Previous request: {statusLabel(knownRequest.status)}.</p> : null}
          <ul className={styles.items}>
            {items.map((item) => {
              const quantity = quantities[item.id] ?? 0;
              const maximum = maxReturnQuantity(item);
              const cannotAddLine = quantity === 0 && selectedLineCount >= RETURN_LINE_MAX_COUNT;
              return (
                <li className={styles.item} key={item.id}>
                  <span className={styles.itemDetails}>
                    <strong>{item.product.name}</strong>
                    <span>Purchased {item.quantity}{item.variant ? ` · ${item.variant}` : ""}</span>
                  </span>
                  <span className={styles.stepper} aria-label={`Return quantity for ${item.product.name}`}>
                    <Button variant="secondary" size="sm" aria-label={`Remove one ${item.product.name}`} disabled={quantity === 0} onClick={() => changeQuantity(item, quantity - 1)}>−</Button>
                    <output aria-label={`${quantity} selected to return`}>{quantity}</output>
                    <Button variant="secondary" size="sm" aria-label={`Add one ${item.product.name}`} disabled={quantity >= maximum || cannotAddLine} onClick={() => changeQuantity(item, quantity + 1)}>+</Button>
                  </span>
                </li>
              );
            })}
          </ul>
          {items.length > RETURN_LINE_MAX_COUNT ? <p className={styles.copy}>You can include up to {RETURN_LINE_MAX_COUNT} different items in one request.</p> : null}
          <label className={styles.reasonLabel} htmlFor="return-reason">Reason for return</label>
          <textarea
            id="return-reason"
            className={styles.reason}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={RETURN_REASON_MAX_LENGTH}
            rows={4}
            placeholder="Tell the seller why you’re requesting a return."
          />
          <p className={styles.counter}>{reason.trim().length}/{RETURN_REASON_MAX_LENGTH} characters · minimum 5</p>
          {validationMessage ? <p className={styles.copy} role="status">{validationMessage}</p> : null}
          {errorMessage ? <p className={styles.error} role="alert">{errorMessage}</p> : null}
          <Button busy={submitting} disabled={Boolean(validationMessage)} onClick={() => onSubmit(toReturnRequestInput(items, quantities, reason))}>
            Submit return request
          </Button>
        </>
      )}
    </section>
  );
}
