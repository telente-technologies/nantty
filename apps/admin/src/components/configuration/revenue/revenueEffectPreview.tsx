"use client";

import { useState } from "react";

import { SelectField } from "@/components/ui/formFields";
import { Card, KeyValueList } from "@/components/ui/surfaces";
import type { Money } from "@/types/api.type";
import type { RevenueRulesConfiguration } from "@/types/platformConfiguration.type";
import { formatBasisPointsAsPercent, formatMoneyForDisplay, formatWholeNumber } from "@/utils/formatting.util";

import { MoneyAmountField, WholeNumberField } from "../shared/configurationFields";
import styles from "./revenueRules.module.css";

function applyBasisPointsToMinorAmount(amountMinor: number, basisPoints: number): number {
  return Math.floor((amountMinor * basisPoints) / 10_000);
}

function moneyOf(amountMinor: number, currency: string): Money {
  return { amountMinor, currency };
}

export function RevenueEffectPreview({ rules }: { readonly rules: RevenueRulesConfiguration }) {
  const currencies = rules.coinUnitValues.map((value) => value.currency);
  const [selectedCurrency, setSelectedCurrency] = useState(currencies[0] ?? rules.supportedCurrencies[0] ?? "");
  const currency = currencies.includes(selectedCurrency) ? selectedCurrency : (currencies[0] ?? selectedCurrency);
  const [giftCoins, setGiftCoins] = useState(1_000);
  const [orderTotal, setOrderTotal] = useState<Money | null>(null);
  const coinValue = rules.coinUnitValues.find((value) => value.currency === currency);
  const giftValueMinor = (coinValue?.amountMinor ?? 0) * giftCoins;
  const creatorGiftMinor = applyBasisPointsToMinorAmount(giftValueMinor, rules.giftCreatorShareBasisPoints);
  const transferFeeCoins = Math.ceil((giftCoins * rules.coinTransferFeeBasisPoints) / 10_000);
  const effectiveOrderTotal = orderTotal && orderTotal.currency === currency ? orderTotal : moneyOf((coinValue?.amountMinor ?? 100) * 5_000, currency);
  const escrowFeeMinor = applyBasisPointsToMinorAmount(effectiveOrderTotal.amountMinor, rules.escrowFee.defaultBasisPoints);

  return (
    <Card title="Effect preview (unsaved values included)">
      <div className={styles.previewInputs}>
        <SelectField label="Currency" value={currency} onChange={(event) => setSelectedCurrency(event.target.value)} options={currencies.map((code) => ({ value: code, label: code }))} />
        <WholeNumberField label="Gift size (coins)" value={giftCoins} minimum={1} maximum={10_000_000} onChange={setGiftCoins} />
        <MoneyAmountField label={`Order total (${currency})`} money={effectiveOrderTotal} currency={currency} onChange={setOrderTotal} />
      </div>
      <KeyValueList
        columns={2}
        items={[
          { label: `Gift of ${formatWholeNumber(giftCoins)} coins is worth`, value: formatMoneyForDisplay(moneyOf(giftValueMinor, currency)) },
          { label: `Creator receives (${formatBasisPointsAsPercent(rules.giftCreatorShareBasisPoints)})`, value: formatMoneyForDisplay(moneyOf(creatorGiftMinor, currency)) },
          { label: "Zudomart keeps from the gift", value: formatMoneyForDisplay(moneyOf(giftValueMinor - creatorGiftMinor, currency)) },
          { label: `Fee if these coins are transferred (${formatBasisPointsAsPercent(rules.coinTransferFeeBasisPoints)})`, value: `${formatWholeNumber(transferFeeCoins)} coins` },
          { label: `Escrow fee on this order (${formatBasisPointsAsPercent(rules.escrowFee.defaultBasisPoints)}, no commission)`, value: formatMoneyForDisplay(moneyOf(escrowFeeMinor, currency)) },
          { label: "Seller receives before withdrawal fee", value: formatMoneyForDisplay(moneyOf(effectiveOrderTotal.amountMinor - escrowFeeMinor, currency)) },
          { label: `Creator share of ${formatMoneyForDisplay(moneyOf(effectiveOrderTotal.amountMinor, currency))} ad revenue`, value: formatMoneyForDisplay(moneyOf(applyBasisPointsToMinorAmount(effectiveOrderTotal.amountMinor, rules.creatorAdShareBasisPoints), currency)) },
        ]}
      />
    </Card>
  );
}
