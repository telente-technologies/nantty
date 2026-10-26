"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modalDialog";
import { adsHubService } from "@/services/adsHub.service";
import { boostsService } from "@/services/boosts.service";
import { createIdempotencyKey, readErrorMessageForDisplay, WebappRequestError } from "@/services/clientApi.service";
import type { BoostBudgetChangePaymentMethod } from "@/types/adsHub.type";
import type { Boost } from "@/types/boost.type";
import { buildBudgetChangeRequest, createIdempotencyKeyHolder, describePaymentOption, firstSelectablePaymentMethod, formatMinorAsMajorInput, parseMajorAmountToMinor } from "@/utils/adsHub.util";
import { boostErrorMessageForCode } from "@/utils/boostPayment.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { openHostedCheckout } from "@/utils/hostedCheckout.util";

import { AdPaymentPicker } from "./adPaymentPicker";
import { formatAdDate } from "./adsHubParts";
import styles from "./adsHub.module.css";

const MAXIMUM_EXTRA_DAYS = 30;

interface AdBudgetChangeDialogProps {
  readonly boost: Boost;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onApplied: (boost: Boost) => void;
}

export function AdBudgetChangeDialog({ boost, isOpen, onClose, onApplied }: AdBudgetChangeDialogProps) {
  const isTotal = boost.budgetType === "total";
  const [extraDays, setExtraDays] = useState(0);
  const [amountText, setAmountText] = useState(isTotal ? "" : formatMinorAsMajorInput(boost.dailyBudget ?? null));
  const [chosenMethod, setChosenMethod] = useState<BoostBudgetChangePaymentMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const keyHolder = useRef(createIdempotencyKeyHolder(() => createIdempotencyKey("ad-budget")));
  const amountMinor = amountText.trim() ? parseMajorAmountToMinor(amountText) : null;
  const amountInvalid = amountText.trim() !== "" && amountMinor === null;
  const request = amountInvalid ? null : buildBudgetChangeRequest(boost, extraDays, amountMinor);
  const quote = useQuery({ queryKey: ["ads", "boost", boost.id, "budgetQuote", request], queryFn: () => adsHubService.quoteBudgetChange(boost.id, request!), enabled: isOpen && Boolean(request), retry: false });
  const options = useQuery({ queryKey: ["boosts", "options"], queryFn: () => boostsService.fetchBoostOptions(), enabled: isOpen });
  const states = (quote.data?.paymentOptions ?? []).filter((option) => option.method === "card" || option.method === "ad_balance").map((option) =>
    describePaymentOption(option, { total: quote.data?.additionalCost ?? null, adFundsSpendable: options.data?.adBalance?.spendable ?? null, earningsAvailable: null, freeBoostMaxTotal: null }, (money) => formatMoneyForDisplay(money)),
  );
  const paymentMethod = firstSelectablePaymentMethod(states, chosenMethod) as BoostBudgetChangePaymentMethod | null;
  const reasonCodes = Object.fromEntries((quote.data?.paymentOptions ?? []).map((option) => [option.method, option.reasonCode]));

  const change = useMutation({
    mutationFn: () => {
      const body = { ...request!, paymentMethod: paymentMethod! };
      return adsHubService.changeBudget(boost.id, body, keyHolder.current.keyFor(body));
    },
    onSuccess: (result) => {
      onApplied(result.boost);
      if (result.checkoutUrl && openHostedCheckout({ checkoutUrl: result.checkoutUrl, reference: result.change.id }) === "redirected") return;
      keyHolder.current.reset();
      onClose();
    },
    onError: (mutationError) => setError(boostErrorMessageForCode(mutationError instanceof WebappRequestError ? mutationError.code : null) ?? readErrorMessageForDisplay(mutationError)),
  });

  const newEndsOn = formatAdDate(quote.data?.newEndsAt ?? null);
  return (
    <ModalDialog
      isOpen={isOpen}
      title="Extend or add budget"
      description="You only pay the difference. Nantty works out the price before you pay."
      onClose={onClose}
      intent="ads"
      busy={change.isPending}
      errorMessage={error}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!request || !quote.data || !paymentMethod || quote.isFetching} busy={change.isPending} onClick={() => { setError(null); change.mutate(); }}>
            {quote.data ? `Pay ${formatMoneyForDisplay(quote.data.additionalCost)}` : "Pay"}
          </Button>
        </>
      )}
    >
      <div className={styles.dialogBody}>
        <label className={styles.field}>
          Extra days
          <input className={styles.input} type="number" inputMode="numeric" min={0} max={MAXIMUM_EXTRA_DAYS} value={extraDays} onChange={(event) => setExtraDays(Math.min(MAXIMUM_EXTRA_DAYS, Math.max(0, Math.round(Number(event.target.value) || 0))))} />
        </label>
        <label className={styles.field}>
          {isTotal ? `Add to total budget (${boost.totalBudget.currency})` : `New daily budget (${boost.totalBudget.currency})`}
          <input className={styles.input} inputMode="decimal" value={amountText} onChange={(event) => setAmountText(event.target.value)} aria-invalid={amountInvalid || undefined} />
        </label>
        {!isTotal && boost.dailyBudget ? <p className={styles.note}>Current daily budget {formatMoneyForDisplay(boost.dailyBudget)}. You can raise it, not lower it.</p> : null}
        {amountInvalid ? <p className={styles.error} role="alert">Enter an amount like 5000 or 5000.50.</p> : null}
        {!request && !amountInvalid ? <p className={styles.note}>Add days or raise the budget to see the price.</p> : null}
        {quote.isError ? <p className={styles.error} role="alert">{boostErrorMessageForCode(quote.error instanceof WebappRequestError ? quote.error.code : null) ?? readErrorMessageForDisplay(quote.error)}</p> : null}
        {quote.data ? (
          <div className={styles.card} aria-live="polite">
            <span className={styles.label}>You pay now</span>
            <span className={styles.metricValue}>{formatMoneyForDisplay(quote.data.additionalCost)}</span>
            <span className={styles.rowMeta}>New total {formatMoneyForDisplay(quote.data.newTotalBudget)} · {quote.data.newDurationDays} days{newEndsOn ? ` · Ends ${newEndsOn}` : ""}</span>
          </div>
        ) : null}
        {quote.data ? <AdPaymentPicker label="Pay the difference with" states={states} reasonCodes={reasonCodes} selected={paymentMethod} onSelect={(method) => { setError(null); setChosenMethod(method as BoostBudgetChangePaymentMethod); }} /> : null}
      </div>
    </ModalDialog>
  );
}
