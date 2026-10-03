"use client";

import { useState } from "react";

import { FeaturePlanBadge, UpgradePlanLink } from "@/components/billing/planGate";
import { useCanEditStoreSettings } from "@/components/settings/settingsFormFrame";
import { Button } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { IntegrationCategory, StoreIntegration } from "@/types/developer.type";
import type { CursorPage } from "@/types/pagination.type";
import { formatRelativeTimeFromNow } from "@/utils/dateFormatting.util";

import styles from "./settings.module.css";

const integrationCategoryLabels: Record<IntegrationCategory, string> = { accounting: "Accounting", spreadsheets: "Spreadsheets", marketing: "Marketing", messaging: "Messaging" };
const integrationStatusPresentation: Record<StoreIntegration["status"], { label: string; tone: "success" | "neutral" | "caution" }> = {
  connected: { label: "Connected", tone: "success" },
  not_connected: { label: "Not connected", tone: "neutral" },
  needs_attention: { label: "Needs attention", tone: "caution" },
};

function IntegrationCard({ integration, onChanged }: { readonly integration: StoreIntegration; readonly onChanged: (updated: StoreIntegration) => void }) {
  const canEdit = useCanEditStoreSettings();
  const { hasFeature } = usePlanFeatures();
  const { showToast } = useToast();
  const [busyAction, setBusyAction] = useState<"connect" | "disconnect" | "sync" | null>(null);
  const isLocked = integration.requiredPlanFeature !== null && !hasFeature(integration.requiredPlanFeature);
  const status = integrationStatusPresentation[integration.status];

  async function runIntegrationAction(action: "connect" | "disconnect" | "sync") {
    setBusyAction(action);
    try {
      const updated = await sendSellerApiRequest<StoreIntegration>(`/seller/integrations/${encodeURIComponent(integration.id)}/${action}`, { method: "POST", body: {} });
      onChanged(updated);
      showToast(action === "connect" ? `${integration.name} connected.` : action === "disconnect" ? `${integration.name} disconnected.` : `${integration.name} synced.`);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <article className={styles.rowCard}>
      <div className={styles.rowHeader}>
        <span className={styles.rowTitle}>
          {integration.name}
          {integration.requiredPlanFeature ? <FeaturePlanBadge feature={integration.requiredPlanFeature} /> : null}
        </span>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>
      <p className={styles.mutedText}>{integration.description}</p>
      {integration.connectedAccount ? <p className={styles.mutedText}>Account: {integration.connectedAccount}{integration.lastSyncedAt ? ` · synced ${formatRelativeTimeFromNow(integration.lastSyncedAt)}` : ""}</p> : null}
      {integration.status === "needs_attention" ? <Callout tone="caution">Access expired. Reconnect to keep syncing.</Callout> : null}
      <div className={styles.inlineActions}>
        {isLocked && integration.requiredPlanFeature ? (
          <UpgradePlanLink feature={integration.requiredPlanFeature} />
        ) : integration.status === "not_connected" ? (
          <Button size="small" variant="primary" disabled={!canEdit} isBusy={busyAction === "connect"} onClick={() => void runIntegrationAction("connect")}>Connect</Button>
        ) : (
          <>
            <Button size="small" disabled={!canEdit} isBusy={busyAction === "sync" || busyAction === "connect"} onClick={() => void runIntegrationAction(integration.status === "needs_attention" ? "connect" : "sync")}>
              {integration.status === "needs_attention" ? "Reconnect" : "Sync now"}
            </Button>
            <Button size="small" variant="ghost" disabled={!canEdit} isBusy={busyAction === "disconnect"} onClick={() => void runIntegrationAction("disconnect")}>Disconnect</Button>
          </>
        )}
      </div>
    </article>
  );
}

export function IntegrationsSettingsView() {
  const integrationsQuery = useSellerQuery<CursorPage<StoreIntegration>>("/seller/integrations");
  const integrations = integrationsQuery.data?.data;
  if (integrationsQuery.isLoading && !integrations) return <LoadingBlock label="Loading integrations" />;
  if (!integrations) return <Callout tone="error" action={<Button size="small" onClick={integrationsQuery.reload}>Try again</Button>}>{integrationsQuery.errorMessage ?? "Integrations could not load."}</Callout>;
  const replaceIntegration = (updated: StoreIntegration) => integrationsQuery.replaceData((current) => (current ? { ...current, data: current.data.map((candidate) => (candidate.id === updated.id ? updated : candidate)) } : current));
  return (
    <>
      {(Object.keys(integrationCategoryLabels) as IntegrationCategory[]).map((category) => {
        const categoryIntegrations = integrations.filter((integration) => integration.category === category);
        if (categoryIntegrations.length === 0) return null;
        return (
          <Panel key={category} title={integrationCategoryLabels[category]}>
            <div className={styles.cardGrid}>
              {categoryIntegrations.map((integration) => (
                <IntegrationCard key={integration.id} integration={integration} onChanged={replaceIntegration} />
              ))}
            </div>
          </Panel>
        );
      })}
    </>
  );
}
