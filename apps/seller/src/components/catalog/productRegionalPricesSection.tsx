"use client";

import { describeVariantDraftTitle, type OptionDraft, type VariantDraft } from "@/components/catalog/productEditorDraft.util";
import { Panel } from "@/components/ui/panel";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";

import styles from "./productEditor.module.css";

const marketLabels: Record<string, string> = {
  NGN: "Nigeria (NGN)", GHS: "Ghana (GHS)", KES: "Kenya (KES)", ZAR: "South Africa (ZAR)", GBP: "United Kingdom (GBP)", EUR: "Eurozone (EUR)", USD: "United States (USD)",
};

interface ProductRegionalPricesSectionProps {
  readonly variants: VariantDraft[];
  readonly options: OptionDraft[];
  readonly fieldErrors: Record<string, string>;
  readonly onVariantChange: (variantKey: string, patch: Partial<VariantDraft>) => void;
}

export function ProductRegionalPricesSection({ variants, options, fieldErrors, onVariantChange }: ProductRegionalPricesSectionProps) {
  const { settings } = useStoreContext();
  const storeCurrency = settings?.currency ?? null;
  const markets = Object.keys(marketLabels).filter((currency) => currency !== storeCurrency);

  function changePrice(variant: VariantDraft, currency: string, text: string) {
    onVariantChange(variant.key, { regionalPriceTextByCurrency: { ...variant.regionalPriceTextByCurrency, [currency]: text.replace(/[^\d.,]/g, "") } });
  }

  return (
    <Panel title="Prices by country" description={`Optional. Leave a country empty and buyers there pay your ${storeCurrency ?? "store"} price, shown to them as an approximate local amount. A country price is charged in that country's currency. If one variant of a product has no price for a country, buyers there pay the default price for the whole order from you.`}>
      <div className={styles.variantTableWrapper}>
        <table className={styles.variantTable}>
          <caption className="visuallyHidden">Prices by country</caption>
          <thead>
            <tr>
              <th scope="col">Variant</th>
              {markets.map((currency) => <th key={currency} scope="col">{marketLabels[currency]}</th>)}
            </tr>
          </thead>
          <tbody>
            {variants.map((variant, index) => (
              <tr key={variant.key}>
                <th scope="row">{describeVariantDraftTitle(variant, options) || `Variant ${index + 1}`}</th>
                {markets.map((currency) => {
                  const message = fieldErrors[`variants.${index}.regionalPrices.${currency}`];
                  return (
                    <td key={currency}>
                      <input
                        className={styles.variantInput}
                        inputMode="decimal"
                        aria-label={`${currency} price for ${describeVariantDraftTitle(variant, options) || `variant ${index + 1}`}`}
                        aria-invalid={message ? true : undefined}
                        placeholder="Default"
                        value={variant.regionalPriceTextByCurrency[currency] ?? ""}
                        onChange={(event) => changePrice(variant, currency, event.target.value)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
