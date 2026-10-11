"use client";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { configurationDocumentEndpoint } from "@/services/configurationApi.service";
import type { Money } from "@/types/api.type";
import type { DebtLevelAmounts, PaymentLimitAmounts, PaymentLimits, SellerDebtLimits } from "@/types/platformConfiguration.type";

import { MoneyAmountField, MoneyPerCurrencyEditor, WholeNumberField } from "../shared/configurationFields";
import { VersionedDocumentSection } from "../shared/versionedDocumentSection";
import styles from "./regionalPricing.module.css";

const sellerDebtEndpoint = configurationDocumentEndpoint<"seller.debtLimits">();
const paymentLimitsEndpoint = configurationDocumentEndpoint<"payments.limits">();
const overrideCurrencies = ["GHS", "KES", "ZAR", "USD", "GBP", "EUR"] as const;

const debtLevels: readonly { readonly key: keyof DebtLevelAmounts; readonly label: string }[] = [
  { key: "unverified", label: "Unverified (L0)" },
  { key: "payoutVerified", label: "Payout-verified (L1)" },
  { key: "identityVerified", label: "Identity-verified (L2) or trusted seller" },
];

type PaymentField = "orderCheckout" | "coinPurchase" | "adsTopUp" | "basic" | "mid" | "full";
const paymentFields: readonly { readonly key: PaymentField; readonly label: string }[] = [
  { key: "orderCheckout", label: "One order (card or bank)" },
  { key: "coinPurchase", label: "One coin purchase" },
  { key: "adsTopUp", label: "One ads top-up" },
  { key: "basic", label: "Wallet per day, basic tier" },
  { key: "mid", label: "Wallet per day, mid tier" },
  { key: "full", label: "Wallet per day, full tier" },
];

const naira = (amountMinor: number): Money => ({ amountMinor, currency: "NGN" });

function readPaymentField(amounts: PaymentLimitAmounts, field: PaymentField): number {
  return field === "basic" || field === "mid" || field === "full" ? amounts.walletDaily[field] : amounts[field];
}

function writePaymentField(amounts: PaymentLimitAmounts, field: PaymentField, value: number): PaymentLimitAmounts {
  return field === "basic" || field === "mid" || field === "full" ? { ...amounts, walletDaily: { ...amounts.walletDaily, [field]: value } } : { ...amounts, [field]: value };
}

function overridesAsMoney<Value>(overrides: Readonly<Record<string, Value>>, read: (value: Value) => number): Money[] {
  return Object.entries(overrides).map(([currency, value]) => ({ currency, amountMinor: read(value) }));
}

function applyOverrideColumn<Value>(overrides: Readonly<Record<string, Value>>, amounts: readonly Money[], empty: Value, write: (value: Value, amountMinor: number) => Value): Record<string, Value> {
  const next: Record<string, Value> = {};
  for (const amount of amounts) next[amount.currency] = write(overrides[amount.currency] ?? empty, amount.amountMinor);
  return next;
}

const emptyDebtLevels: DebtLevelAmounts = { unverified: 0, payoutVerified: 0, identityVerified: 0 };
const emptyPaymentAmounts: PaymentLimitAmounts = { orderCheckout: 0, coinPurchase: 0, adsTopUp: 0, walletDaily: { basic: 0, mid: 0, full: 0 } };

export function MoneyLimitsPanel() {
  const { can } = useAdminPermissions();
  const canWrite = can("config:revenue");
  return (
    <div className={styles.sections}>
      <VersionedDocumentSection<SellerDebtLimits>
        endpoint={sellerDebtEndpoint}
        recordId="seller.debtLimits"
        title="Seller debt limits"
        canWrite={canWrite}
        renderEditor={(content, updateContent, isWritable) => (
          <div className={styles.sections}>
            <p className={styles.note}>
              When a seller owes more than their limit, new listings and new checkouts against them are blocked with SELLER_DEBT_LIMIT. Shipping, delivery confirmations and dispute replies on existing orders keep working. Outside Nigeria the limit is the percentage below of the naira amount, converted with the current exchange rates, unless a currency override is set. Saving asks for your authenticator code.
            </p>
            <div className={styles.fieldGrid}>
              {debtLevels.map((level) => (
                <MoneyAmountField key={level.key} label={`${level.label}, Nigeria`} money={naira(content.baseMinor[level.key])} currency="NGN" isDisabled={!isWritable} onChange={(money) => updateContent((current) => ({ ...current, baseMinor: { ...current.baseMinor, [level.key]: money?.amountMinor ?? 0 } }))} />
              ))}
              <WholeNumberField label="Outside Nigeria, % of the naira amount" value={content.outsideNigeriaPercent} minimum={1} maximum={100} isDisabled={!isWritable} onChange={(outsideNigeriaPercent) => updateContent((current) => ({ ...current, outsideNigeriaPercent }))} />
              <WholeNumberField label="Trusted seller: account age (days)" hint="With a clean record, these sellers get the identity-verified limit." value={content.trustedSellerAgeDays} minimum={0} maximum={3650} isDisabled={!isWritable} onChange={(trustedSellerAgeDays) => updateContent((current) => ({ ...current, trustedSellerAgeDays }))} />
              <WholeNumberField label="Trusted seller: days without upheld disputes or chargebacks" value={content.trustedSellerCleanDays} minimum={0} maximum={3650} isDisabled={!isWritable} onChange={(trustedSellerCleanDays) => updateContent((current) => ({ ...current, trustedSellerCleanDays }))} />
            </div>
            {debtLevels.map((level) => (
              <MoneyPerCurrencyEditor
                key={level.key}
                label={`Override: ${level.label}`}
                amounts={overridesAsMoney(content.currencyOverridesMinor, (value) => value[level.key])}
                supportedCurrencies={overrideCurrencies}
                isDisabled={!isWritable}
                onChange={(amounts) => updateContent((current) => ({ ...current, currencyOverridesMinor: applyOverrideColumn(current.currencyOverridesMinor, amounts, emptyDebtLevels, (value, amountMinor) => ({ ...value, [level.key]: amountMinor })) }))}
              />
            ))}
          </div>
        )}
      />
      <VersionedDocumentSection<PaymentLimits>
        endpoint={paymentLimitsEndpoint}
        recordId="payments.limits"
        title="Payment limits"
        canWrite={canWrite}
        renderEditor={(content, updateContent, isWritable) => (
          <div className={styles.sections}>
            <p className={styles.note}>
              The largest single payment of each type, and how much a wallet can pay in a day by its KYC tier (basic is payout-verified, mid is identity-verified, full is identity plus business verified). Larger orders get PAYMENT_AMOUNT_OUT_OF_RANGE with a contact-support reason; wallet payments over the day&apos;s limit get WALLET_DAILY_LIMIT. Other currencies use the converted naira amounts unless overridden. Saving asks for your authenticator code.
            </p>
            <div className={styles.fieldGrid}>
              {paymentFields.map((field) => (
                <MoneyAmountField key={field.key} label={`${field.label}, NGN`} money={naira(readPaymentField(content.baseMinor, field.key))} currency="NGN" isDisabled={!isWritable} onChange={(money) => updateContent((current) => ({ ...current, baseMinor: writePaymentField(current.baseMinor, field.key, money?.amountMinor ?? 0) }))} />
              ))}
            </div>
            {paymentFields.map((field) => (
              <MoneyPerCurrencyEditor
                key={field.key}
                label={`Override: ${field.label}`}
                amounts={overridesAsMoney(content.currencyOverridesMinor, (value) => readPaymentField(value, field.key))}
                supportedCurrencies={overrideCurrencies}
                isDisabled={!isWritable}
                onChange={(amounts) => updateContent((current) => ({ ...current, currencyOverridesMinor: applyOverrideColumn(current.currencyOverridesMinor, amounts, emptyPaymentAmounts, (value, amountMinor) => writePaymentField(value, field.key, amountMinor)) }))}
              />
            ))}
          </div>
        )}
      />
    </div>
  );
}
