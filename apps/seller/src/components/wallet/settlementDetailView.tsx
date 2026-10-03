"use client";

import Link from "next/link";

import { WalletTabs } from "@/components/wallet/walletTabs";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { KeyValueList, PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { SettlementDetail } from "@/types/finance.type";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./wallet.module.css";
import { IconLabel } from "@/components/ui/zudoIcon";

export function SettlementDetailView({ settlementId }: { readonly settlementId: string }) {
  const { formatMoney } = useMoneyFormatter();
  const detailQuery = useSellerQuery<SettlementDetail>(`/seller/finance/settlements/${encodeURIComponent(settlementId)}`);
  const detail = detailQuery.data;
  if (!detail) {
    return (
      <PageStack>
        <Link href="/wallet/settlements" className={styles.panelLink}><IconLabel name="arrowLeft24" size={16}>All settlements</IconLabel></Link>
        {detailQuery.errorMessage ? <Callout tone="error" action={<Button size="small" onClick={detailQuery.reload}>Try again</Button>}>{detailQuery.errorMessage}</Callout> : <LoadingBlock label="Loading settlement" />}
      </PageStack>
    );
  }
  const { settlement } = detail;
  return (
    <PageStack>
      <Link href="/wallet/settlements" className={`${styles.panelLink} noPrint`}><IconLabel name="arrowLeft24" size={16}>All settlements</IconLabel></Link>
      <PageHeader title={`Settlement ${settlement.reference}`} description={`${formatDateForDisplay(settlement.periodStart)} – ${formatDateForDisplay(settlement.periodEnd)}`} actions={<Button variant="ghost" onClick={() => window.print()}>Print</Button>} />
      <WalletTabs />
      <Panel title="Summary" actions={<StatusBadge tone={settlement.status === "settled" ? "success" : "info"}>{settlement.status === "settled" ? "Settled" : "Clearing"}</StatusBadge>}>
        <KeyValueList
          items={[
            { label: "Orders", value: settlement.ordersCount },
            { label: "Gross (items total)", value: formatMoney(settlement.gross) },
            { label: "Fees", value: `−${formatMoney(settlement.fees)}` },
            { label: "Net to wallet", value: <strong>{formatMoney(settlement.net)}</strong> },
            { label: settlement.status === "settled" ? "Settled on" : "Settles on", value: formatDateTimeForDisplay(settlement.settledAt) },
          ]}
        />
      </Panel>
      <Panel padded={false} title="Orders in this settlement">
        <DataTable
          caption="Orders in this settlement"
          rows={detail.orders}
          readRowKey={(entry) => entry.orderId}
          emptyState="No orders in this settlement."
          columns={[
            { key: "order", header: "Order", render: (entry) => <Link href={`/orders/${entry.orderId}`}>{entry.orderNumber}</Link> },
            { key: "buyer", header: "Buyer", hideBelowTablet: true, render: (entry) => entry.buyerName },
            { key: "released", header: "Released", hideBelowTablet: true, render: (entry) => formatDateTimeForDisplay(entry.releasedAt) },
            { key: "gross", header: "Gross", align: "end", render: (entry) => formatMoney(entry.gross) },
            { key: "fees", header: "Fees", align: "end", hideBelowTablet: true, render: (entry) => `−${formatMoney(entry.fees)}` },
            { key: "net", header: "Net", align: "end", render: (entry) => <strong>{formatMoney(entry.net)}</strong> },
          ]}
        />
      </Panel>
    </PageStack>
  );
}
