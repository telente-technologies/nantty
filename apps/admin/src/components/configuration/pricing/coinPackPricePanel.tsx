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
import type { CoinPackPriceRow } from "@/types/regionalPricing.type";
import { formatMoneyForDisplay } from "@/utils/formatting.util";

import { MoneyAmountField } from "../shared/configurationFields";
import styles from "./regionalPricing.module.css";

const currencies = ["NGN", "GHS", "KES", "ZAR", "GBP", "EUR", "USD"] as const;
const platformOptions = [
  { value: "web", label: "Web (Paystack)" },
  { value: "ios", label: "iOS (App Store)" },
  { value: "android", label: "Android (Google Play)" },
];

function CoinPackDialog({ pack, onClose, onSaved }: { readonly pack: CoinPackPriceRow; readonly onClose: () => void; readonly onSaved: (pack: CoinPackPriceRow) => void }) {
  const [prices, setPrices] = useState<Record<string, number>>({ ...pack.prices });
  const [reason, setReason] = useState("");
  const { showToast } = useToast();
  const save = useAdminMutation((input: { readonly row: CoinPackPriceRow; readonly reason: string }) => saveCoinPackPriceRow(input.row, input.reason));
  const submit = async () => {
    const saved = await save.run({ row: { ...pack, prices }, reason });
    if (!saved) return;
    showToast(`${pack.name} (${pack.clientPlatform}) saved.`);
    onSaved(saved);
  };
  return (
    <ModalDialog
      isOpen
      width="wide"
      title={`${pack.name} · ${pack.clientPlatform}`}
      description={pack.storeProductId ? `Store product id ${pack.storeProductId}. The store charges the price set for each storefront; keep these in step.` : "Charged on the web through Paystack."}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" isBusy={save.isRunning} disabled={reason.trim().length < 3} onClick={() => void submit()}>Save prices</Button>
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
  if (table.errorMessage) return <ErrorBlock message={table.errorMessage} onRetry={table.reload} />;
  const rows = (table.data?.data ?? []).filter((pack) => pack.clientPlatform === platform);
  return (
    <Card title="Coin packs per channel and currency">
      <p className={styles.note}>A coin pack has the same number of coins everywhere; only the price changes by currency. Web packs are cheaper and carry bonus coins because Paystack costs far less than the 15–30% store fee.</p>
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
