"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/feedback";
import { SegmentedControl, TextField } from "@/components/ui/formFields";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { billingApi } from "@/services/billingApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { BillingOverview, FundingMode } from "@/types/billing.type";
import { createClientIdempotencyKey } from "@/utils/formValidation.util";
import { formatMajorAmountForInput, formatMoneyForDisplay, parseTypedMajorAmountToMoney, readCurrencySymbol } from "@/utils/money.util";

import { openPaystackCheckoutIfSafe } from "./hostedCheckout.util";
import styles from "./billingPage.module.css";

interface PaymentSettingsCardProps {
  readonly accountId: string;
  readonly overview: BillingOverview;
  readonly canManageBilling: boolean;
  readonly onOverviewChange: (overview: BillingOverview) => void;
  readonly onReloadOverview: () => void;
}

const fundingModeOptions: readonly { value: FundingMode; label: string }[] = [
  { value: "prepaid", label: "Prepaid balance" },
  { value: "card", label: "Card" },
  { value: "prepaid_and_card", label: "Balance, then card" },
];

export function PaymentSettingsCard({ accountId, overview, canManageBilling, onOverviewChange, onReloadOverview }: PaymentSettingsCardProps) {
  const { showToast } = useToast();
  const currency = overview.balance.currency;
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [typedLimit, setTypedLimit] = useState(formatMajorAmountForInput(overview.spendLimit.amount));
  const [limitError, setLimitError] = useState<string | undefined>();
  const [cardIdempotencyKey] = useState(() => createClientIdempotencyKey("card"));

  async function runBillingChange(actionName: string, change: () => Promise<void>) {
    setBusyAction(actionName);
    try {
      await change();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusyAction(null);
    }
  }

  const changeFundingMode = (fundingMode: FundingMode) =>
    runBillingChange("funding", async () => {
      onOverviewChange(await billingApi.updateFundingMode(accountId, fundingMode));
      showToast("Payment method updated");
    });

  const saveSpendLimit = (removeLimit: boolean) => {
    const amount = removeLimit ? null : parseTypedMajorAmountToMoney(typedLimit, currency);
    if (!removeLimit && (!amount || amount.amountMinor <= 0)) {
      setLimitError("Enter a monthly limit above zero.");
      return;
    }
    setLimitError(undefined);
    return runBillingChange("limit", async () => {
      onOverviewChange(await billingApi.updateSpendLimit(accountId, amount));
      setIsEditingLimit(false);
      showToast(removeLimit ? "Spend limit removed" : "Spend limit saved");
    });
  };

  const startAddingCardThroughProvider = () =>
    runBillingChange("addCard", async () => {
      const checkout = await billingApi.startAddingCard(accountId, "paystack", cardIdempotencyKey);
      if (!(await openPaystackCheckoutIfSafe(checkout, `/accounts/${accountId}/billing/return?cardReference=${encodeURIComponent(checkout.reference)}`))) showToast("The card page address was not recognised, so we did not open it.", "error");
    });

  const spentShare = overview.spendLimit.amount ? Math.min(1, overview.spendLimit.spent.amountMinor / Math.max(overview.spendLimit.amount.amountMinor, 1)) : 0;

  return (
    <Card title="Payment settings" description="How delivery is paid for, and the most this account may spend each month.">
      <div className={styles.stack} style={{ gap: 10 }}>
        <p style={{ fontSize: 12.5, fontWeight: 600 }}>Pay for ads with</p>
        {canManageBilling ? (
          <SegmentedControl label="Pay for ads with" value={overview.fundingMode} onValueChange={changeFundingMode} options={fundingModeOptions} />
        ) : (
          <p>{fundingModeOptions.find((option) => option.value === overview.fundingMode)?.label}</p>
        )}
      </div>

      <div className={styles.section}>
        <h3>Cards</h3>
        {overview.paymentMethods.length === 0 ? <p className={styles.muted}>No cards saved. Ads are paid from the prepaid balance.</p> : null}
        <ul className={styles.cardList}>
          {overview.paymentMethods.map((method) => (
            <li key={method.id} className={styles.cardRow}>
              <ZudoIcon name="creditCard24" size={20} />
              <div>
                <p className={styles.cardBrand}>
                  {method.brand} ···· {method.last4}
                </p>
                <p className={styles.muted}>
                  Expires {String(method.expMonth).padStart(2, "0")}/{method.expYear} · Paystack
                </p>
              </div>
              <div className={styles.cardRowEnd}>
                {method.isDefault ? <StatusBadge tone="info">Default</StatusBadge> : null}
                {canManageBilling && !method.isDefault ? (
                  <Button size="small" variant="ghost" disabled={busyAction !== null} onClick={() => runBillingChange("default", async () => onOverviewChange(await billingApi.makeCardDefault(accountId, method.id)))}>
                    Make default
                  </Button>
                ) : null}
                {canManageBilling ? (
                  <Button size="small" variant="ghost" iconName="trash24" aria-label={`Remove ${method.brand} ending ${method.last4}`} disabled={busyAction !== null} onClick={() => runBillingChange("remove", async () => {
                    await billingApi.removeCard(accountId, method.id);
                    showToast("Card removed");
                    onReloadOverview();
                  })} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {canManageBilling ? (
          <div>
            <Button size="small" iconName="plus16" isLoading={busyAction === "addCard"} onClick={startAddingCardThroughProvider}>
              Add a card
            </Button>
          </div>
        ) : null}
      </div>

      <div className={styles.section}>
        <h3>Monthly spend limit</h3>
        {overview.spendLimit.amount ? (
          <div>
            <div className={styles.meter} role="meter" aria-label="Spend this month against the limit" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(spentShare * 100)}>
              <div className={spentShare > 0.85 ? `${styles.meterFill} ${styles.meterFillWarning}` : styles.meterFill} style={{ width: `${spentShare * 100}%` }} />
            </div>
            <p className={styles.muted}>
              {formatMoneyForDisplay(overview.spendLimit.spent)} of {formatMoneyForDisplay(overview.spendLimit.amount)} spent this month. Ads stop when the limit is reached.
            </p>
          </div>
        ) : (
          <p className={styles.muted}>No limit. {formatMoneyForDisplay(overview.spendLimit.spent)} spent this month.</p>
        )}
        {canManageBilling && !isEditingLimit ? (
          <div>
            <Button size="small" onClick={() => setIsEditingLimit(true)}>
              {overview.spendLimit.amount ? "Change limit" : "Set a limit"}
            </Button>
          </div>
        ) : null}
        {isEditingLimit ? (
          <div className={styles.inlineForm}>
            <TextField label="Monthly limit" inputMode="decimal" prefix={readCurrencySymbol(currency)} value={typedLimit} onValueChange={setTypedLimit} error={limitError} />
            <Button variant="primary" isLoading={busyAction === "limit"} onClick={() => saveSpendLimit(false)}>
              Save limit
            </Button>
            {overview.spendLimit.amount ? (
              <Button variant="ghost" disabled={busyAction !== null} onClick={() => saveSpendLimit(true)}>
                Remove limit
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => setIsEditingLimit(false)}>
              Cancel
            </Button>
          </div>
        ) : null}
        {overview.fundingMode !== "prepaid" && overview.paymentMethods.length === 0 ? <InlineNotice tone="caution">Add a card, or switch to the prepaid balance.</InlineNotice> : null}
      </div>
    </Card>
  );
}
