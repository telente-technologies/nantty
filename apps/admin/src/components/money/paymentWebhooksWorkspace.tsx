"use client";

import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { SegmentedTabs } from "@/components/ui/tabs";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchDeadLetteredWebhooks } from "@/services/paymentWebhooksApi.service";
import type { DeadLetteredWebhook } from "@/types/paymentWebhooks.type";
import { formatRelativeTimeFromNow } from "@/utils/formatting.util";

import styles from "./money.module.css";
import { PaymentWebhookDetailPanel } from "./paymentWebhookDetailPanel";

type ProviderTab = "all" | "flutterwave" | "paystack";

const webhookColumns: readonly DataTableColumn<DeadLetteredWebhook>[] = [
  { key: "event", header: "Event", render: (webhook) => <span className={styles.stack}><span>{webhook.eventType}</span><span className={styles.muted}>{webhook.provider}</span></span> },
  { key: "reference", header: "Reference", render: (webhook) => webhook.reference || "—", isMono: true },
  { key: "attempts", header: "Attempts", render: (webhook) => webhook.attempts, align: "end" },
  { key: "error", header: "Last error", render: (webhook) => <span className={styles.muted}>{webhook.lastError || "—"}</span> },
  { key: "dead", header: "Gave up", render: (webhook) => <span className={styles.muted}>{webhook.deadLetteredAt ? formatRelativeTimeFromNow(webhook.deadLetteredAt) : "—"}</span> },
];

export function PaymentWebhooksWorkspace() {
  const [provider, setProvider] = useState<ProviderTab>("all");
  const [openWebhookId, setOpenWebhookId] = useState<string | null>(null);
  const { data, errorMessage, isLoading, reload } = useAdminQuery((signal) => fetchDeadLetteredWebhooks(provider === "all" ? undefined : provider, signal), provider);

  return (
    <>
      <PageHeader area="Money" title="Payment webhooks" description="Provider events that failed 12 times and stopped retrying. Fix the cause first, then replay; a replay re-checks the payment with the provider before any money moves." />
      <SegmentedTabs label="Provider" items={[{ key: "all", label: "All" }, { key: "flutterwave", label: "Flutterwave" }, { key: "paystack", label: "Paystack" }]} activeKey={provider} onChange={setProvider} />
      {errorMessage ? <ErrorBlock message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Dead-lettered payment webhooks" columns={webhookColumns} rows={data?.items ?? []} readRowKey={(webhook) => webhook.id} isLoading={isLoading} selectedRowKey={openWebhookId} onRowOpen={(webhook) => setOpenWebhookId(webhook.id)} emptyMessage="No failed webhooks. Every provider event was processed." />
      {openWebhookId ? <PaymentWebhookDetailPanel key={openWebhookId} webhookId={openWebhookId} onClose={() => setOpenWebhookId(null)} onReplayed={reload} /> : null}
    </>
  );
}
