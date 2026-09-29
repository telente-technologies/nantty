import { Button } from "@/components/ui/button";
import type { PlanPrice } from "@/types/platformConfiguration.type";

import { MoneyAmountField } from "../shared/configurationFields";
import styles from "./plansEditor.module.css";

interface PlanPriceTableProps {
  readonly planName: string;
  readonly prices: readonly PlanPrice[];
  readonly supportedCurrencies: readonly string[];
  readonly canWrite: boolean;
  readonly onChange: (prices: PlanPrice[]) => void;
}

export function PlanPriceTable({ planName, prices, supportedCurrencies, canWrite, onChange }: PlanPriceTableProps) {
  function replacePriceForCurrency(currency: string, updater: (price: PlanPrice) => PlanPrice) {
    onChange(prices.map((price) => (price.currency === currency ? updater(price) : price)));
  }
  function addPriceForCurrency(currency: string) {
    const ordered = supportedCurrencies.map((code) => prices.find((price) => price.currency === code) ?? (code === currency ? { currency, monthly: { amountMinor: 0, currency }, yearly: null } : null)).filter((price): price is PlanPrice => price !== null);
    onChange(ordered);
  }
  return (
    <table className={styles.priceTable}>
      <caption className="visuallyHidden">Prices for {planName} in each currency</caption>
      <thead>
        <tr>
          <th scope="col">Currency</th>
          <th scope="col">Monthly</th>
          <th scope="col">Yearly</th>
          <th scope="col">
            <span className="visuallyHidden">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {supportedCurrencies.map((currency) => {
          const price = prices.find((candidate) => candidate.currency === currency);
          if (!price) {
            return (
              <tr key={currency} className={styles.unpricedRow}>
                <th scope="row">{currency}</th>
                <td colSpan={2}>Not sold in {currency}</td>
                <td>{canWrite ? <Button size="small" variant="ghost" iconName="plus16" onClick={() => addPriceForCurrency(currency)}>Price</Button> : null}</td>
              </tr>
            );
          }
          return (
            <tr key={currency}>
              <th scope="row">{currency}</th>
              <td>
                <MoneyAmountField label={`${planName} monthly price in ${currency}`} isLabelHidden money={price.monthly} currency={currency} isDisabled={!canWrite} onChange={(monthly) => replacePriceForCurrency(currency, (current) => ({ ...current, monthly }))} />
              </td>
              <td>
                <MoneyAmountField label={`${planName} yearly price in ${currency}`} isLabelHidden money={price.yearly} currency={currency} isDisabled={!canWrite} onChange={(yearly) => replacePriceForCurrency(currency, (current) => ({ ...current, yearly }))} />
              </td>
              <td>{canWrite ? <Button size="small" variant="ghost" iconName="trash24" aria-label={`Stop selling ${planName} in ${currency}`} onClick={() => onChange(prices.filter((candidate) => candidate.currency !== currency))} /> : null}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
