"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { DataTable } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { Card } from "@/components/ui/surfaces";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchPlanPriceTable } from "@/services/pricingApi.service";
import type { PlanPriceRow } from "@/types/regionalPricing.type";
import { formatMoneyForDisplay } from "@/utils/formatting.util";

import { PlanPriceRowDialog } from "./planPriceRowDialog";
import styles from "./regionalPricing.module.css";

const planLabels: Record<string, string> = {
  blue_essential: "Blue Essential",
  blue: "Blue Verified",
  premium: "Premium (Blue Premium)",
  seller_pro: "Seller Pro (Gold)",
  seller_business: "Seller Business (Gold)",
  gold_only: "Gold only",
  black: "Black (government)",
};

const priceOrDash = (amountMinor: number, currency: string) => (amountMinor > 0 ? formatMoneyForDisplay({ amountMinor, currency }) : "Not sold");

export function PlanPriceBookPanel() {
  const { can } = useAdminPermissions();
  const table = useAdminQuery((signal) => fetchPlanPriceTable(signal), "plan-price-table");
  const [planCode, setPlanCode] = useState("blue");
  const [editing, setEditing] = useState<PlanPriceRow | null>(null);
  if (table.errorMessage) return <ErrorBlock variant="section" error={table.error} message={table.errorMessage} onRetry={table.reload} />;
  const rows = (table.data?.data ?? []).filter((row) => row.planCode === planCode);
  return (
    <Card title="Plan price book">
      <p className={styles.note}>Web prices are charged by the payment partner (Flutterwave). When the partner can&apos;t charge a region&apos;s currency, web buyers there see and pay the US price in USD. App prices must match the price set for that storefront in App Store Connect and Play Console.</p>
      <div className={styles.toolbar}>
        <SelectField label="Plan" value={planCode} onChange={(event) => setPlanCode(event.target.value)} options={Object.entries(planLabels).map(([value, label]) => ({ value, label }))} />
      </div>
      <div className={styles.tableScroller}>
        <DataTable
          caption={`${planLabels[planCode] ?? planCode} prices by region`}
          rows={rows}
          isLoading={table.isLoading}
          readRowKey={(row) => `${row.planCode}:${row.countryCode}`}
          onRowOpen={can("config:revenue") ? setEditing : undefined}
          columns={[
            { key: "region", header: "Region", render: (row) => `${row.countryCode} · ${row.currency}`, isMono: true },
            { key: "web", header: "Web monthly / yearly", render: (row) => `${priceOrDash(row.monthlyAmountMinor, row.currency)} / ${priceOrDash(row.yearlyAmountMinor, row.currency)}` },
            { key: "ios", header: "iOS monthly / yearly", render: (row) => `${priceOrDash(row.iosMonthlyAmountMinor, row.currency)} / ${priceOrDash(row.iosYearlyAmountMinor, row.currency)}` },
            { key: "android", header: "Android monthly / yearly", render: (row) => `${priceOrDash(row.androidMonthlyAmountMinor, row.currency)} / ${priceOrDash(row.androidYearlyAmountMinor, row.currency)}` },
            { key: "status", header: "Status", render: (row) => (row.active ? "Active" : "Paused") },
          ]}
        />
      </div>
      {editing ? (
        <PlanPriceRowDialog
          row={editing}
          planLabel={planLabels[editing.planCode] ?? editing.planCode}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            table.replaceData((current) => (current ? { ...current, data: current.data.map((row) => (row.planCode === saved.planCode && row.countryCode === saved.countryCode ? saved : row)) } : current));
            setEditing(null);
          }}
        />
      ) : null}
    </Card>
  );
}
