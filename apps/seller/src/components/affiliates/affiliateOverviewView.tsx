"use client";

import { AffiliateCreatorIdentity } from "@/components/affiliates/affiliateCreatorIdentity";
import { AffiliateProgramSettingsForm } from "@/components/affiliates/affiliateProgramSettingsForm";
import { ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { Callout, EmptyState, ErrorCallout, LoadingBlock, StatTile } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { AffiliateOverview } from "@/types/affiliate.type";

import styles from "./affiliateViews.module.css";

export function AffiliateOverviewView() {
  const overviewQuery = useSellerQuery<AffiliateOverview>("/seller/affiliates/overview");
  const { formatMoney } = useMoneyFormatter();
  const overview = overviewQuery.data;

  if (overviewQuery.isLoading && !overview) return <LoadingBlock label="Loading your affiliate program" />;
  if (!overview) return <ErrorCallout variant="section" error={overviewQuery.error} message={overviewQuery.errorMessage ?? "Could not load the affiliate program."} onRetry={overviewQuery.reload} />;

  return (
    <>
      {overview.pendingRequestsCount > 0 ? (
        <Callout tone="info" title={`${overview.pendingRequestsCount} creator${overview.pendingRequestsCount === 1 ? " wants" : "s want"} to sell your products`} action={<ButtonLink href="/affiliates/requests" size="small" variant="primary">Review requests</ButtonLink>} />
      ) : null}
      <div className={styles.statGrid}>
        <StatTile label="Sales driven by creators" value={formatMoney(overview.creatorDrivenSales)} detail="All time, excluding refunds" />
        <StatTile label="Commission owed" value={formatMoney(overview.commissionsOwed)} detail="Held in escrow until delivery is confirmed" tone="caution" />
        <StatTile label="Commission paid" value={formatMoney(overview.commissionsPaid)} detail="Paid automatically at escrow release" tone="positive" />
        <StatTile label="Active creators" value={overview.activeCreatorsCount} />
      </div>
      <div className={styles.twoColumns}>
        <Panel title="Program settings">
          <AffiliateProgramSettingsForm settings={overview.settings} onSaved={() => overviewQuery.reload()} />
        </Panel>
        <Panel title="Top creators" actions={<ButtonLink href="/affiliates/creators" size="small">All creators</ButtonLink>} padded={false}>
          <DataTable
            caption="Top creators by sales"
            rows={overview.topCreators}
            readRowKey={(row) => row.creator.id}
            emptyState={<EmptyState iconName="videoCamera24" title="No creators yet" description="Approve creator requests to start selling through their posts, clips and lives." />}
            columns={[
              { key: "creator", header: "Creator", render: (row) => <AffiliateCreatorIdentity creator={row.creator} showNiche={false} /> },
              { key: "orders", header: "Orders", align: "end", render: (row) => row.orders },
              { key: "sales", header: "Sales", align: "end", render: (row) => formatMoney(row.sales) },
              { key: "owed", header: "Owed", align: "end", hideBelowTablet: true, render: (row) => formatMoney(row.commissionOwed) },
            ]}
          />
        </Panel>
      </div>
      <p className={styles.muted}>You never pay creators yourself. Nantty deducts each commission from the order when escrow is released and pays the creator through the ledger.</p>
    </>
  );
}
