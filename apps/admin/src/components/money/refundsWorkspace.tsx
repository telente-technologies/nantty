"use client";

import { useState, type FormEvent } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ErrorBlock, InlineError } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { CursorPagination } from "@/components/ui/pagination";
import { Card, Toolbar } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { readErrorMessageForDisplay } from "@/services/adminApiClient.service";
import { fetchOrderDetail, fetchRefunds } from "@/services/moneyApi.service";
import type { OrderDetail } from "@/types/commerce.type";
import { formatMoneyForDisplay } from "@/utils/formatting.util";

import { IssueRefundDialog } from "./issueRefundDialog";
import styles from "./money.module.css";
import { RefundsTable } from "./refundsTable";

const sourceTabs = [
  { key: "all", label: "All refunds" },
  { key: "manual", label: "Manual" },
  { key: "dispute", label: "From disputes" },
  { key: "seller", label: "By sellers" },
  { key: "return", label: "Returns" },
  { key: "cancellation", label: "Cancellations" },
  { key: "system", label: "Automatic" },
] as const;

function ManualRefundFinder({ onRefunded }: { readonly onRefunded: () => void }) {
  const [orderReference, setOrderReference] = useState("");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLooking, setIsLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  async function findOrder(event: FormEvent) {
    event.preventDefault();
    setIsLooking(true);
    setLookupError(null);
    try {
      const found = await fetchOrderDetail(orderReference.trim());
      if (found.refundable.amountMinor <= 0) setLookupError(`${found.orderNumber} has nothing refundable right now (unpaid, fully refunded or a refund is already running).`);
      else if (found.status === "disputed") setLookupError(`${found.orderNumber} has an open dispute. Resolve it from the dispute page.`);
      else setOrder(found);
    } catch (error) {
      setLookupError(readErrorMessageForDisplay(error));
    } finally {
      setIsLooking(false);
    }
  }

  return (
    <Card title="Issue a manual refund">
      <form onSubmit={findOrder}>
        <Toolbar>
          <TextField label="Order number or ID" placeholder="ZM-24819 or order ID" value={orderReference} onChange={(event) => setOrderReference(event.target.value)} className={styles.searchField} />
          <Button type="submit" isBusy={isLooking} disabled={orderReference.trim().length < 3}>Find order</Button>
        </Toolbar>
      </form>
      {lookupError ? <InlineError message={lookupError} /> : null}
      <p className={styles.muted}>Use this for lost parcels, cancelled deliveries and goodwill refunds. Refunds up to what is still in escrow{order ? `, now ${formatMoneyForDisplay(order.refundable)}` : ""}.</p>
      {order ? <IssueRefundDialog order={order} isOpen onClose={() => setOrder(null)} onRefunded={onRefunded} /> : null}
    </Card>
  );
}

export function RefundsWorkspace() {
  const { can } = useAdminPermissions();
  const [source, setSource] = useState<(typeof sourceTabs)[number]["key"]>("all");
  const [cursor, setCursor] = useState<string | undefined>();
  const filters = { source: source === "all" ? undefined : source, cursor };
  const { data, errorMessage, isLoading, reload } = useAdminQuery((signal) => fetchRefunds(filters, signal), JSON.stringify(filters));

  return (
    <>
      <PageHeader area="Money" title="Refunds" description="Every refund paid out of escrow, whether from a dispute decision or issued by hand." />
      {can("refunds:issue") ? <ManualRefundFinder onRefunded={reload} /> : null}
      <div className={styles.spacedTop}>
        <SegmentedTabs label="Refund source" items={sourceTabs} activeKey={source} onChange={(key) => { setSource(key); setCursor(undefined); }} />
      </div>
      {errorMessage ? <ErrorBlock message={errorMessage} onRetry={reload} /> : null}
      <RefundsTable refunds={data?.items ?? []} isLoading={isLoading} emptyMessage="No refunds yet." />
      <CursorPagination cursor={cursor} nextCursor={data?.nextCursor} onCursorChange={setCursor} />
    </>
  );
}
