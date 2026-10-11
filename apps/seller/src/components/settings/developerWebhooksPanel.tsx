"use client";

import { useState } from "react";

import { DeveloperWebhookDialog } from "@/components/settings/developerWebhookDialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { ModalDialog } from "@/components/ui/modalDialog";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { WebhookDelivery, WebhookEndpoint } from "@/types/developer.type";
import type { CursorPage } from "@/types/pagination.type";
import { formatDateTimeForDisplay, formatRelativeTimeFromNow } from "@/utils/dateFormatting.util";

import styles from "./settings.module.css";

const deliveryOutcomeTone: Record<WebhookDelivery["outcome"], "success" | "error" | "caution"> = { delivered: "success", failed: "error", retrying: "caution" };

export function DeveloperWebhooksPanel() {
  const webhooksQuery = useSellerQuery<CursorPage<WebhookEndpoint>>("/seller/developers/webhooks");
  const deliveriesQuery = useSellerQuery<CursorPage<WebhookDelivery>>("/seller/developers/webhook-deliveries");
  const { showToast } = useToast();
  const [editingWebhook, setEditingWebhook] = useState<WebhookEndpoint | "new" | null>(null);
  const [webhookPendingDelete, setWebhookPendingDelete] = useState<WebhookEndpoint | null>(null);
  const [busyWebhookId, setBusyWebhookId] = useState<string | null>(null);
  const webhooks = webhooksQuery.data?.data ?? null;
  const webhookUrlById = new Map((webhooks ?? []).map((webhook) => [webhook.id, webhook.url]));

  function reloadWebhooksAndDeliveries() {
    webhooksQuery.reload();
    deliveriesQuery.reload();
  }

  async function runWebhookAction(webhook: WebhookEndpoint, action: () => Promise<unknown>, successMessage: string) {
    setBusyWebhookId(webhook.id);
    try {
      await action();
      showToast(successMessage);
      reloadWebhooksAndDeliveries();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusyWebhookId(null);
    }
  }

  return (
    <>
      <Panel title="Webhooks" description="Get told the moment something happens in your store." padded={false} actions={<Button variant="primary" size="small" iconName="plus16" onClick={() => setEditingWebhook("new")}>Add webhook</Button>}>
        <DataTable<WebhookEndpoint>
          caption="Webhook endpoints"
          rows={webhooks}
          isLoading={webhooksQuery.isLoading}
          errorMessage={webhooksQuery.errorMessage}
          onRetry={webhooksQuery.reload}
          readRowKey={(webhook) => webhook.id}
          emptyState="No webhooks yet."
          columns={[
            { key: "url", header: "Endpoint", render: (webhook) => <span className={styles.rowTitle}><span className={styles.monospace}>{webhook.url}</span>{webhook.description ? <span className={styles.mutedText}>{webhook.description}</span> : null}</span> },
            { key: "events", header: "Events", hideBelowTablet: true, render: (webhook) => `${webhook.events.length} ${webhook.events.length === 1 ? "event" : "events"}` },
            { key: "status", header: "Status", render: (webhook) => (!webhook.active ? <StatusBadge>Paused</StatusBadge> : webhook.recentFailureCount > 0 ? <StatusBadge tone="caution">{webhook.recentFailureCount} failed recently</StatusBadge> : <StatusBadge tone="success">Healthy</StatusBadge>) },
            { key: "last", header: "Last delivery", hideBelowTablet: true, render: (webhook) => (webhook.lastDeliveryAt ? formatRelativeTimeFromNow(webhook.lastDeliveryAt) : "Never") },
            {
              key: "actions",
              header: <span className="visuallyHidden">Actions</span>,
              align: "end",
              render: (webhook) => (
                <span className={styles.inlineActions}>
                  <Button size="small" variant="ghost" isBusy={busyWebhookId === webhook.id} onClick={() => void runWebhookAction(webhook, () => sendSellerApiRequest(`/seller/developers/webhooks/${encodeURIComponent(webhook.id)}/test`, { method: "POST" }), "Test event sent.")}>Send test</Button>
                  <Button size="small" variant="ghost" onClick={() => void runWebhookAction(webhook, () => sendSellerApiRequest(`/seller/developers/webhooks/${encodeURIComponent(webhook.id)}`, { method: "PATCH", body: { active: !webhook.active } }), webhook.active ? "Webhook paused." : "Webhook resumed.")}>{webhook.active ? "Pause" : "Resume"}</Button>
                  <Button size="small" variant="ghost" onClick={() => setEditingWebhook(webhook)}>Edit</Button>
                  <Button size="small" variant="ghost" onClick={() => setWebhookPendingDelete(webhook)}>Delete</Button>
                </span>
              ),
            },
          ]}
        />
      </Panel>
      <Panel title="Recent deliveries" description="The last 50 attempts across your webhooks." padded={false}>
        <DataTable<WebhookDelivery>
          caption="Webhook deliveries"
          rows={deliveriesQuery.data?.data ?? null}
          isLoading={deliveriesQuery.isLoading}
          errorMessage={deliveriesQuery.errorMessage}
          onRetry={deliveriesQuery.reload}
          readRowKey={(delivery) => delivery.id}
          emptyState="Nothing sent yet."
          columns={[
            { key: "when", header: "When", render: (delivery) => formatDateTimeForDisplay(delivery.attemptedAt) },
            { key: "event", header: "Event", render: (delivery) => <span className={styles.monospace}>{delivery.event}</span> },
            { key: "endpoint", header: "Endpoint", hideBelowTablet: true, render: (delivery) => <span className={styles.monospace}>{webhookUrlById.get(delivery.webhookId) ?? "Removed endpoint"}</span> },
            { key: "result", header: "Result", render: (delivery) => <StatusBadge tone={deliveryOutcomeTone[delivery.outcome]}>{delivery.responseStatus ?? "No response"}</StatusBadge> },
            { key: "time", header: "Time", align: "end", hideBelowTablet: true, render: (delivery) => (delivery.durationMilliseconds === null ? "—" : `${delivery.durationMilliseconds} ms`) },
          ]}
        />
      </Panel>
      {editingWebhook ? <DeveloperWebhookDialog webhook={editingWebhook === "new" ? null : editingWebhook} onClose={() => setEditingWebhook(null)} onSaved={reloadWebhooksAndDeliveries} /> : null}
      <ModalDialog intent="delete"
        isOpen={webhookPendingDelete !== null}
        onClose={() => setWebhookPendingDelete(null)}
        width="small"
        title="Delete this webhook?"
        footer={
          <>
            <Button onClick={() => setWebhookPendingDelete(null)}>Keep it</Button>
            <Button variant="danger" isBusy={busyWebhookId === webhookPendingDelete?.id} onClick={() => webhookPendingDelete && void runWebhookAction(webhookPendingDelete, () => sendSellerApiRequest(`/seller/developers/webhooks/${encodeURIComponent(webhookPendingDelete.id)}`, { method: "DELETE" }), "Webhook deleted.").then(() => setWebhookPendingDelete(null))}>
              Delete webhook
            </Button>
          </>
        }
      >
        We stop sending events to {webhookPendingDelete?.url} immediately.
      </ModalDialog>
    </>
  );
}
