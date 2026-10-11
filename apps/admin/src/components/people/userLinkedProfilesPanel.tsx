"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DataTable } from "@/components/ui/dataTable";
import { ErrorBlock, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { CheckboxField } from "@/components/ui/formFields";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { convertLinkedProfile, fetchLinkedProfiles, resolveLinkedProfiles } from "@/services/linkedProfilesApi.service";
import type { LinkedProfileItem } from "@/types/linkedProfiles.type";

import styles from "./peopleWorkspace.module.css";

const KIND_LABELS = { store: "Store", business: "Business page", brand: "Brand" } as const;
const STATUS_TONES = { active: "success", held: "caution", retired: "neutral" } as const;

export function UserLinkedProfilesPanel({ userId }: { readonly userId: string }) {
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const { data, errorMessage, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchLinkedProfiles(userId, signal), userId);
  const [converting, setConverting] = useState<LinkedProfileItem | null>(null);
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [keep, setKeep] = useState<readonly string[]>([]);
  const convertMutation = useAdminMutation((reason: string) => convertLinkedProfile(userId, { profileId: converting!.profileId, toKind: converting!.kind === "store" ? "business" : "store", reason }));
  const resolveMutation = useAdminMutation((reason: string) => resolveLinkedProfiles(userId, { keep, reason }));

  if (errorMessage) return <ErrorBlock variant="section" message={errorMessage} onRetry={reload} />;
  if (isLoading || !data) return <LoadingBlock lines={4} />;
  const canManage = can("users:moderate");

  async function convert(reason: string) {
    const updated = await convertMutation.run(reason);
    if (!updated) return;
    replaceData(() => updated);
    setConverting(null);
    showToast("Profile converted. The change is in the audit log.");
  }

  async function resolve(reason: string) {
    const updated = await resolveMutation.run(reason);
    if (!updated) return;
    replaceData(() => updated);
    setIsResolveOpen(false);
    showToast("Profiles resolved. The ones not kept can no longer post or list.");
  }

  return (
    <>
      <Card
        title="Linked profiles"
        actions={canManage && data.items.length > 0 ? <Button size="small" onClick={() => { setKeep(data.items.filter((item) => item.status === "active").map((item) => item.profileId)); setIsResolveOpen(true); }}>Choose which to keep</Button> : null}
      >
        <p className={styles.muted}>One Store or one Business page, never both, plus one Brand.</p>
        {data.choiceRequired ? <NoticeBanner tone="caution" title="Breaks the profile rule">This account has extra profiles on hold. They can&apos;t post or add listings until the owner, or you, choose which to keep.</NoticeBanner> : null}
        <DataTable
          caption="Linked profiles"
          rows={data.items}
          readRowKey={(row) => row.profileId}
          emptyMessage="No Store, Business page or Brand."
          columns={[
            { key: "kind", header: "Type", render: (row) => KIND_LABELS[row.kind] },
            { key: "name", header: "Name", render: (row) => <>{row.name || "Pending application"}{row.handle ? <span className={styles.muted}> @{row.handle}</span> : null}</> },
            { key: "status", header: "Status", render: (row) => <StatusBadge label={row.status} tone={STATUS_TONES[row.status]} hasDot={false} /> },
            { key: "mart", header: "Mart icon", render: (row) => (row.showsMart ? "Shown" : "Hidden") },
            { key: "actions", header: "", align: "end", render: (row) => (canManage && row.kind !== "brand" ? <Button size="small" variant="ghost" onClick={() => setConverting(row)}>Convert to {row.kind === "store" ? "Business page" : "Store"}</Button> : null) },
          ]}
        />
      </Card>
      {converting ? (
        <ConfirmActionDialog
          intent="transfer"
          isOpen
          title={`Convert ${converting.name || "profile"} to a ${converting.kind === "store" ? "Business page" : "Store"}`}
          consequences={converting.kind === "store" ? ["The store must already be closed.", "The page loses the Mart icon and products tab."] : ["The page becomes the account's Store and can open a shop.", "It gains the Mart icon once the store is created."]}
          confirmLabel="Convert"
          requiresStepUp
          isBusy={convertMutation.isRunning}
          errorMessage={convertMutation.errorMessage}
          onConfirm={convert}
          onClose={() => { convertMutation.clearError(); setConverting(null); }}
        />
      ) : null}
      {isResolveOpen ? (
        <ConfirmActionDialog
          intent="edit"
          isOpen
          title="Choose which profiles to keep"
          consequences={["Keep at most one Store or Business page and one Brand.", "Profiles you don't keep stay visible but can't post or list. Open orders and payouts carry on."]}
          confirmLabel="Save choice"
          tone="danger"
          requiresStepUp
          isBusy={resolveMutation.isRunning}
          errorMessage={resolveMutation.errorMessage}
          onConfirm={resolve}
          onClose={() => { resolveMutation.clearError(); setIsResolveOpen(false); }}
        >
          {data.items.map((item) => (
            <CheckboxField
              key={item.profileId}
              label={`${KIND_LABELS[item.kind]}: ${item.name || item.profileId}`}
              checked={keep.includes(item.profileId)}
              onChange={(event) => setKeep(event.target.checked ? [...keep, item.profileId] : keep.filter((id) => id !== item.profileId))}
            />
          ))}
        </ConfirmActionDialog>
      ) : null}
    </>
  );
}
