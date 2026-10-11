"use client";

import { useState } from "react";

import { requestConfirmation } from "@zudomart/web-kit";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { OverlayDialog } from "@/components/ui/overlayDialog";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, PageHeader } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { audiencesApi } from "@/services/audiencesApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { CustomAudience } from "@/types/audience.type";
import { formatRelativeTimeFromNow } from "@/utils/dateRange.util";
import { formatRangeOfPeople } from "@/utils/numberFormatting.util";

import { customAudienceStatusDisplay, customAudienceTypeLabels } from "./audienceLabels.constant";
import styles from "./audiencesPage.module.css";
import { CreateAudienceDialog, type CreatableAudienceType } from "./createAudienceDialog";
import { CustomerListUploadDialog } from "./customerListUploadDialog";

type OpenDialog = { kind: "chooser" } | { kind: "create"; audienceType: CreatableAudienceType } | { kind: "customerList" } | { kind: "rename"; audience: CustomAudience } | null;

const createOptions: readonly { type: CreatableAudienceType | "customer_list"; title: string; description: string; needsStore: boolean }[] = [
  { type: "store_customers", title: "Store customers", description: "People who ordered from your Zudomart store.", needsStore: true },
  { type: "engagers", title: "Engaged people", description: "People who liked, watched, saved or messaged.", needsStore: false },
  { type: "followers", title: "Followers", description: "Everyone who follows your profile.", needsStore: false },
  { type: "customer_list", title: "Customer list", description: "Emails or phone numbers, hashed on your device.", needsStore: false },
  { type: "lookalike", title: "Lookalike", description: "New people similar to one of your audiences.", needsStore: false },
];

export function AudiencesPage() {
  const { accountId, account, canPerform } = useAdAccount();
  const { showToast } = useToast();
  const audiencesQuery = useAdsQuery(() => audiencesApi.listCustomAudiences(accountId), accountId);
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const [renameText, setRenameText] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const canManageAudiences = canPerform("audiences:manage");
  const audiences = audiencesQuery.data?.items ?? [];

  function handleAudienceCreated(audience: CustomAudience) {
    setOpenDialog(null);
    showToast(`Created "${audience.name}"`);
    audiencesQuery.reload();
  }

  async function renameAudience(audience: CustomAudience) {
    if (!renameText.trim()) return;
    setIsBusy(true);
    try {
      await audiencesApi.renameCustomAudience(accountId, audience.id, renameText.trim());
      showToast("Audience renamed");
      setOpenDialog(null);
      audiencesQuery.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteAudience(audience: CustomAudience) {
    if (!(await requestConfirmation({ title: `Delete "${audience.name}"?`, description: "Ad sets that use it will stop targeting it.", confirmLabel: "Delete audience", tone: "danger", intent: "delete" }))) return;
    try {
      await audiencesApi.deleteCustomAudience(accountId, audience.id);
      showToast("Audience deleted");
      audiencesQuery.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    }
  }

  const columns: DataTableColumn<CustomAudience>[] = [
    {
      key: "name",
      header: "Audience",
      isAlwaysVisible: true,
      sortValue: (row) => row.name.toLowerCase(),
      render: (row) => (
        <div className={styles.nameCell}>
          <strong>{row.name}</strong>
          <span className={styles.description}>{row.description}</span>
        </div>
      ),
    },
    { key: "type", header: "Type", render: (row) => customAudienceTypeLabels[row.type], sortValue: (row) => row.type },
    { key: "status", header: "Status", render: (row) => <StatusBadge tone={customAudienceStatusDisplay[row.status].tone}>{customAudienceStatusDisplay[row.status].label}</StatusBadge> },
    { key: "size", header: "Size", align: "end", render: (row) => formatRangeOfPeople(row.approximateSize), sortValue: (row) => row.approximateSize?.upper ?? null },
    { key: "usedIn", header: "Used in", align: "end", render: (row) => `${row.usedInAdSetCount} ad set${row.usedInAdSetCount === 1 ? "" : "s"}`, sortValue: (row) => row.usedInAdSetCount },
    { key: "updated", header: "Updated", render: (row) => formatRelativeTimeFromNow(row.updatedAt), sortValue: (row) => row.updatedAt },
    ...(canManageAudiences
      ? [
          {
            key: "actions",
            header: "Actions",
            isAlwaysVisible: true,
            render: (row: CustomAudience) => (
              <div className={styles.rowActions}>
                <Button size="small" variant="ghost" onClick={() => { setRenameText(row.name); setOpenDialog({ kind: "rename", audience: row }); }}>
                  Rename
                </Button>
                <Button size="small" variant="ghost" iconName="trash24" aria-label={`Delete ${row.name}`} onClick={() => deleteAudience(row)} />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Audiences"
        description="Saved groups of people to include or exclude in ad sets."
        actions={canManageAudiences ? <Button variant="primary" iconName="plus16" onClick={() => setOpenDialog({ kind: "chooser" })}>Create audience</Button> : null}
      />
      {audiencesQuery.errorMessage ? <ErrorState error={audiencesQuery.error} message={audiencesQuery.errorMessage} onRetry={audiencesQuery.reload} /> : null}
      <Card padded={false}>
        {audiencesQuery.isLoading && !audiencesQuery.data ? (
          <LoadingBlock />
        ) : (
          <DataTable
            caption="Custom audiences"
            columns={columns}
            rows={audiences}
            readRowId={(row) => row.id}
            showColumnPicker
            emptyState={<EmptyState iconName="userCircle24" title="No audiences yet" description="Create one from your store customers, followers or a hashed customer list." />}
          />
        )}
      </Card>
      {openDialog?.kind === "chooser" ? (
        <OverlayDialog intent="audience" isOpen onClose={() => setOpenDialog(null)} title="Create an audience" width={640}>
          <div className={styles.createGrid}>
            {createOptions.map((option) => {
              const isUnavailable = option.needsStore && !account.business;
              return (
                <button key={option.type} type="button" className={styles.createOption} disabled={isUnavailable} onClick={() => setOpenDialog(option.type === "customer_list" ? { kind: "customerList" } : { kind: "create", audienceType: option.type })}>
                  <span className={styles.createOptionTitle}>{option.title}</span>
                  <span className={styles.description}>{isUnavailable ? "Needs a business account linked to a store." : option.description}</span>
                </button>
              );
            })}
          </div>
        </OverlayDialog>
      ) : null}
      {openDialog?.kind === "create" ? <CreateAudienceDialog accountId={accountId} defaultCountryCode={account.countryCode} audienceType={openDialog.audienceType} sourceAudiences={audiences} onClose={() => setOpenDialog(null)} onCreated={handleAudienceCreated} /> : null}
      {openDialog?.kind === "customerList" ? <CustomerListUploadDialog accountId={accountId} defaultCountryCode={account.countryCode} onClose={() => setOpenDialog(null)} onCreated={handleAudienceCreated} /> : null}
      {openDialog?.kind === "rename" ? (
        <OverlayDialog intent="edit"
          isOpen
          onClose={() => setOpenDialog(null)}
          title="Rename audience"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpenDialog(null)}>Cancel</Button>
              <Button variant="primary" isLoading={isBusy} onClick={() => renameAudience(openDialog.audience)}>Save name</Button>
            </>
          }
        >
          <TextField label="Audience name" value={renameText} onValueChange={setRenameText} maxLength={100} />
        </OverlayDialog>
      ) : null}
    </>
  );
}
