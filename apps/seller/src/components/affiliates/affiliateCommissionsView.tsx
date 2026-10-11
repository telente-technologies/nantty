"use client";

import { useState } from "react";

import { AffiliateCommissionLedgerPanel } from "@/components/affiliates/affiliateCommissionLedgerPanel";
import { AffiliateProductCommissionEditor } from "@/components/affiliates/affiliateProductCommissionEditor";
import { DataTable } from "@/components/ui/dataTable";
import { ErrorCallout } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/filterControls";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { AffiliateProgramSettings, ProductCommissionRow } from "@/types/affiliate.type";
import type { CursorPage } from "@/types/pagination.type";
import { formatBasisPointsAsPercent } from "@/utils/money.util";

import styles from "./affiliateViews.module.css";

export function AffiliateCommissionsView() {
  const [searchText, setSearchText] = useState("");
  const settingsQuery = useSellerQuery<AffiliateProgramSettings>("/seller/affiliates/settings");
  const commissionsQuery = useSellerQuery<CursorPage<ProductCommissionRow>>("/seller/affiliates/product-commissions", { q: searchText, limit: 100 });
  const { formatMoney } = useMoneyFormatter();
  const defaultCommissionBasisPoints = settingsQuery.data?.defaultCommissionBasisPoints ?? null;

  return (
    <>
      <Panel
        title="Commission per product"
        description={defaultCommissionBasisPoints === null ? "Leave a product empty to use your default commission." : `Leave a product empty to use your default of ${formatBasisPointsAsPercent(defaultCommissionBasisPoints)}. Excluded products earn creators nothing.`}
        actions={<SearchInput label="Search products" value={searchText} onValueChange={setSearchText} />}
        padded={false}
      >
        {commissionsQuery.errorMessage ? <ErrorCallout error={commissionsQuery.error} message={commissionsQuery.errorMessage} onRetry={commissionsQuery.reload} /> : null}
        <DataTable
          caption="Affiliate commission per product"
          rows={commissionsQuery.data?.data ?? null}
          isLoading={commissionsQuery.isLoading}
          readRowKey={(row) => row.productId}
          emptyState="No online products match your search."
          columns={[
            {
              key: "product",
              header: "Product",
              render: (row) => (
                <span className={styles.productCell}>
                  {row.imageUrl ? <img src={row.imageUrl} alt="" className={styles.thumbnail} loading="lazy" /> : <span className={styles.thumbnail} aria-hidden="true" />}
                  <span>{row.productName}</span>
                </span>
              ),
            },
            { key: "price", header: "Price", align: "end", hideBelowTablet: true, render: (row) => formatMoney(row.price) },
            { key: "earns", header: "Creator earns", align: "end", render: (row) => (row.excluded ? <StatusBadge>Excluded</StatusBadge> : formatMoney(row.estimatedCommission)) },
            { key: "rate", header: "Commission", align: "end", width: "260px", render: (row) => <AffiliateProductCommissionEditor key={`${row.productId}-${row.commissionBasisPoints}-${row.excluded}`} row={row} defaultCommissionBasisPoints={defaultCommissionBasisPoints} onSaved={commissionsQuery.reload} /> },
          ]}
        />
      </Panel>
      <AffiliateCommissionLedgerPanel />
    </>
  );
}
