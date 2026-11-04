"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock, NoticeBanner } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { Card } from "@/components/ui/surfaces";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchEventQueues } from "@/services/eventOperationsApi.service";
import { filterEventQueues, type EventQueueKindFilter } from "@/utils/eventQueueFilters.util";
import type { EventConsumerRegistration, EventQueueSnapshot } from "@/types/eventOperations.type";

import styles from "./eventOperationsWorkspace.module.css";

const numberFormat = new Intl.NumberFormat();

function formatCount(value: number): string {
  return numberFormat.format(value);
}

export function EventOperationsWorkspace() {
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [queueKind, setQueueKind] = useState<EventQueueKindFilter>("all");
  const { data, error, errorMessage, isLoading, reload } = useAdminQuery(async (signal) => {
    const result = await fetchEventQueues(signal);
    setLastCheckedAt(new Date().toISOString());
    return result;
  }, "event-operations-queues");

  const columns: readonly DataTableColumn<EventQueueSnapshot>[] = [
    { key: "queue", header: "Queue", render: (queue) => <span className={styles.queueName}>{queue.name}</span>, isMono: true },
    { key: "state", header: "Broker state", render: (queue) => <StatusBadge label={queue.state} tone={queue.state.toLowerCase() === "running" ? "success" : "caution"} /> },
    { key: "ready", header: "Ready", render: (queue) => formatCount(queue.messagesReady), align: "end" },
    { key: "unacked", header: "Unacknowledged", render: (queue) => formatCount(queue.messagesUnacknowledged), align: "end" },
    { key: "consumers", header: "Consumers", render: (queue) => formatCount(queue.consumers), align: "end" },
    { key: "kind", header: "Queue type", render: (queue) => queue.deadLetter ? <StatusBadge label="Dead letter" tone="danger" /> : <span className="muted">Work queue</span> },
  ];
  const consumerColumns: readonly DataTableColumn<EventConsumerRegistration>[] = [
    { key: "queue", header: "Queue", render: (consumer) => <span className={styles.queueName}>{consumer.queueName}</span>, isMono: true },
    { key: "ack", header: "Acknowledgements", render: (consumer) => consumer.ackRequired ? "Manual ack required" : "Auto ack" },
    { key: "prefetch", header: "Prefetch", render: (consumer) => formatCount(consumer.prefetchCount), align: "end" },
    { key: "exclusive", header: "Exclusive", render: (consumer) => consumer.exclusive ? "Yes" : "No" },
  ];

  const summary = data?.summary;
  const visibleQueues = useMemo(() => filterEventQueues(data?.data ?? [], search, queueKind), [data?.data, search, queueKind]);
  const consumerRows = useMemo(() => (data?.consumers.registrations ?? []).map((consumer, index) => ({
    ...consumer,
    rowKey: `${consumer.queueName}:${index}`,
  })), [data?.consumers.registrations]);
  return (
    <>
      <PageHeader
        area="Operations"
        title="Event operations"
        description="Read-only RabbitMQ queue pressure and registered-consumer inventory. This screen never exposes message bodies or triggers replay."
        actions={<Button iconName="refresh20" onClick={reload} isBusy={isLoading}>Refresh queues</Button>}
        meta={
          <span className={styles.lastChecked}>
            {lastCheckedAt ? (
              <>Last successful read <time dateTime={lastCheckedAt}>{new Date(lastCheckedAt).toLocaleString()}</time></>
            ) : "Queue counts are checked when this page loads."}
          </span>
        }
      />

      <NoticeBanner tone="caution" title="Operational view only">
        Broker consumer registrations confirm only that a client connection is registered; they do not prove application handlers are healthy or processing successfully. Platform-wide outbox lag is not yet available. DLQ redrive and outbox replay remain disabled until consumer idempotency and recovery procedures are verified.
      </NoticeBanner>

      {errorMessage ? <ErrorBlock error={error} message={errorMessage} onRetry={reload} /> : null}
      {errorMessage && data ? (
        <NoticeBanner tone="caution" title="Showing the last successful snapshot">
          The latest refresh failed. Queue counts below were last read {lastCheckedAt ? new Date(lastCheckedAt).toLocaleString() : "during an earlier successful request"}; retry before using them to make an operational decision.
        </NoticeBanner>
      ) : null}

      <section className={styles.summaryGrid} aria-label="Queue summary">
        <SummaryCard label="Queues" value={summary?.queueCount} isLoading={isLoading} detail="Visible in configured vhost" />
        <SummaryCard label="Ready messages" value={summary?.readyMessages} isLoading={isLoading} detail="Waiting for a consumer" tone={summary && summary.readyMessages > 0 ? "caution" : "normal"} />
        <SummaryCard label="Unacknowledged" value={summary?.unacknowledgedMessages} isLoading={isLoading} detail="Delivered but not acknowledged" />
        <SummaryCard label="DLQ backlog" value={summary?.deadLetterReadyMessages} isLoading={isLoading} detail={`${formatCount(summary?.deadLetterQueueCount ?? 0)} dead-letter queues`} tone={summary && summary.deadLetterReadyMessages > 0 ? "danger" : "normal"} />
      </section>

      <div className={styles.filters} role="search" aria-label="Filter broker queues">
        <TextField label="Search queues" isLabelHidden type="search" placeholder="Search queue name or state" value={search} onChange={(event) => setSearch(event.target.value)} />
        <SelectField
          label="Queue type"
          isLabelHidden
          value={queueKind}
          onChange={(event) => setQueueKind(event.target.value as EventQueueKindFilter)}
          options={[
            { value: "all", label: "All queue types" },
            { value: "work", label: "Work queues" },
            { value: "dead-letter", label: "Dead-letter queues" },
          ]}
        />
        <p className={styles.resultCount} aria-live="polite">
          {isLoading && !data ? "Loading queues…" : `${formatCount(visibleQueues.length)} of ${formatCount(data?.data.length ?? 0)} queues`}
        </p>
      </div>

      <Card title="Broker queues" actions={<span className={styles.sourceLabel}>RabbitMQ management API · counters only</span>} isFlush>
        <DataTable
          caption="RabbitMQ queue health"
          columns={columns}
          rows={visibleQueues}
          readRowKey={(queue) => queue.name}
          isLoading={isLoading}
          emptyMessage={errorMessage && !data ? "Queue counters are unavailable. Retry after checking the broker monitor configuration." : search || queueKind !== "all" ? "No queues match these filters." : "No queues were returned for the configured virtual host."}
        />
      </Card>
      <Card title="Registered consumers" actions={<span className={styles.sourceLabel}>Broker registrations · not worker health</span>} isFlush>
        {data?.consumers.status === "unavailable" ? (
          <NoticeBanner tone="caution" title="Consumer inventory unavailable">
            Queue counters loaded, but RabbitMQ could not return the consumer registration list. Refresh or check the broker monitoring API.
          </NoticeBanner>
        ) : data?.consumers.status === "unsupported" ? (
          <NoticeBanner tone="caution" title="Consumer inventory not supported">
            The configured queue reader does not expose consumer registrations.
          </NoticeBanner>
        ) : null}
        <DataTable
          caption="RabbitMQ registered consumers"
          columns={consumerColumns}
          rows={consumerRows}
          readRowKey={(consumer) => consumer.rowKey}
          isLoading={isLoading}
          emptyMessage={data?.consumers.status === "available" ? "RabbitMQ reports no registered consumers for this virtual host." : "Consumer registrations are unavailable."}
        />
      </Card>
    </>
  );
}

function SummaryCard({ label, value, isLoading, detail, tone = "normal" }: { readonly label: string; readonly value?: number; readonly isLoading: boolean; readonly detail: string; readonly tone?: "normal" | "caution" | "danger" }) {
  return (
    <article className={`${styles.summaryCard} ${styles[tone]}`} aria-busy={isLoading || undefined}>
      <p className={styles.summaryLabel}>{label}</p>
      <p className={styles.summaryValue}>{value === undefined ? (isLoading ? "—" : "Unavailable") : formatCount(value)}</p>
      <p className={styles.summaryDetail}>{detail}</p>
    </article>
  );
}
