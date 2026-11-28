"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { ErrorBlock, InlineError } from "@/components/ui/feedback";
import { SelectField, TextAreaField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { Card } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchCoinPackPriceTable, saveCoinPackPriceRow } from "@/services/pricingApi.service";
import { coinCountryCurrencies } from "@/constants/coinCountryCurrencies.constant";
import type { CoinPackPriceRow } from "@/types/regionalPricing.type";
import { formatMoneyForDisplay } from "@/utils/formatting.util";

import { MoneyAmountField } from "../shared/configurationFields";
import styles from "./regionalPricing.module.css";

const currencies = ["NGN", "GHS", "KES", "ZAR", "GBP", "EUR", "USD"] as const;
const platformOptions = [
  { value: "web", label: "Web checkout" },
  { value: "ios", label: "iOS (App Store)" },
  { value: "android", label: "Android (Google Play)" },
];

function CoinPackDialog({ pack, onClose, onSaved }: { readonly pack: CoinPackPriceRow; readonly onClose: () => void; readonly onSaved: (pack: CoinPackPriceRow) => void }) {
  const [prices, setPrices] = useState<Record<string, number>>({ ...pack.prices });
  const [countryPrices, setCountryPrices] = useState<Record<string, { currency: string; amountMinor: number }>>({ ...pack.countryPrices });
  const [reason, setReason] = useState("");
  const { showToast } = useToast();
  const save = useAdminMutation((input: { readonly row: CoinPackPriceRow; readonly reason: string }) => saveCoinPackPriceRow(input.row, input.reason));
  const submit = async () => {
    if (Object.values(countryPrices).some((price) => price.amountMinor <= 0)) {
      showToast("Enter a positive amount for every country override before saving.");
      return;
    }
    const saved = await save.run({ row: { ...pack, prices, countryPrices }, reason });
    if (!saved) return;
    showToast(`${pack.name} (${pack.clientPlatform}) saved.`);
    onSaved(saved);
  };
  return (
    <ModalDialog intent="coins"
      isOpen
      width="wide"
      title={`${pack.name} · ${pack.clientPlatform}`}
      description={pack.storeProductId ? `Store product id ${pack.storeProductId}. The store charges the price set for each storefront; keep these in step.` : "Charged on the web through the payment partner's checkout."}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" isBusy={save.isRunning} disabled={reason.trim().length < 5} onClick={() => void submit()}>Save prices</Button>
        </>
      }
    >
      <div className={styles.fieldGrid}>
        {currencies.map((currency) => (
          <MoneyAmountField
            key={currency}
            label={`Price in ${currency}`}
            currency={currency}
            money={prices[currency] ? { amountMinor: prices[currency], currency } : null}
            onChange={(money) =>
              setPrices((current) => {
                const next = { ...current };
                if (money && money.amountMinor > 0) next[currency] = money.amountMinor;
                else delete next[currency];
                return next;
              })
            }
          />
        ))}
      </div>
      <div>
        <p className={styles.note}>Country overrides apply to the selected country when its currency matches. App Store and Google Play localized prices must also match the product price configured in each store; store checkout remains authoritative.</p>
        {Object.entries(countryPrices).map(([country, value]) => (
          <div className={styles.fieldGrid} key={country}>
            <SelectField
              label="Country"
              value={country}
              onChange={(event) => {
                const nextCountry = event.target.value;
                const nextCurrency = coinCountryCurrencies[nextCountry];
                setCountryPrices((current) => {
                  const next = { ...current };
                  delete next[country];
                  if (nextCurrency) next[nextCountry] = { ...value, currency: nextCurrency };
                  return next;
                });
              }}
              options={Object.entries(coinCountryCurrencies).filter(([code]) => code === country || !countryPrices[code]).map(([code, currency]) => ({ value: code, label: `${code} · ${currency}` }))}
            />
            <MoneyAmountField
              label={`Country price (${value.currency})`}
              currency={value.currency}
              money={value.amountMinor > 0 ? { amountMinor: value.amountMinor, currency: value.currency } : null}
              onChange={(money) => {
                if (!money) {
                  setCountryPrices((current) => { const next = { ...current }; delete next[country]; return next; });
                  return;
                }
                setCountryPrices((current) => ({ ...current, [country]: { currency: value.currency, amountMinor: money.amountMinor } }));
              }}
            />
          </div>
        ))}
        <Button variant="secondary" disabled={Object.keys(countryPrices).length >= Object.keys(coinCountryCurrencies).length} onClick={() => {
          const nextCountry = Object.keys(coinCountryCurrencies).find((code) => !countryPrices[code]);
          if (nextCountry) setCountryPrices((current) => ({ ...current, [nextCountry]: { currency: coinCountryCurrencies[nextCountry] ?? "USD", amountMinor: 0 } }));
        }}>Add country override</Button>
      </div>
      <TextAreaField label="Reason for the change" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
      {save.errorMessage ? <InlineError message={save.errorMessage} /> : null}
    </ModalDialog>
  );
}

export function CoinPackPricePanel() {
  const { can } = useAdminPermissions();
  const table = useAdminQuery((signal) => fetchCoinPackPriceTable(signal), "coin-pack-price-table");
  const [platform, setPlatform] = useState("web");
  const [editing, setEditing] = useState<CoinPackPriceRow | null>(null);
  if (table.errorMessage) return <ErrorBlock variant="section" error={table.error} message={table.errorMessage} onRetry={table.reload} />;
  const rows = (table.data?.data ?? []).filter((pack) => pack.clientPlatform === platform);
  return (
    <Card title="Coin packs by channel, currency and country">
      <p className={styles.note}>A coin pack has a fixed coin amount for each purchase channel. Prices can vary by currency and include supported country overrides. Storefront prices still need to match App Store Connect or Play Console.</p>
      <div className={styles.toolbar}>
        <SelectField label="Channel" value={platform} onChange={(event) => setPlatform(event.target.value)} options={platformOptions} />
      </div>
      <div className={styles.tableScroller}>
        <DataTable
          caption="Coin pack prices"
          rows={rows}
          isLoading={table.isLoading}
          readRowKey={(pack) => pack.id}
          onRowOpen={can("config:revenue") ? setEditing : undefined}
          columns={[
            { key: "coins", header: "Coins", render: (pack) => `${pack.coins.toLocaleString("en-US")}${pack.bonusCoins ? ` +${pack.bonusCoins}` : ""}` },
            ...currencies.map((currency) => ({ key: currency, header: currency, align: "end" as const, render: (pack: CoinPackPriceRow) => (pack.prices[currency] ? formatMoneyForDisplay({ amountMinor: pack.prices[currency], currency }) : "—") })),
            { key: "country", header: "Country overrides", render: (pack: CoinPackPriceRow) => Object.entries(pack.countryPrices).map(([country, price]) => `${country} ${formatMoneyForDisplay(price)}`).join(" · ") || "—" },
          ]}
        />
      </div>
      {editing ? (
        <CoinPackDialog
          pack={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            table.replaceData((current) => (current ? { ...current, data: current.data.map((pack) => (pack.id === saved.id ? saved : pack)) } : current));
            setEditing(null);
          }}
        />
      ) : null}
    </Card>
  );
}
