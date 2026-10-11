"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { SegmentedTabs } from "@/components/ui/tabs";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchLegalDocumentDetail } from "@/services/legalApi.service";
import { formatDateOnly } from "@/utils/formatting.util";

import { LegalNoticeDraftPanel } from "./legalNoticeDraftPanel";
import { LegalOpenVersionPanel } from "./legalOpenVersionPanel";
import { LegalVersionHistory } from "./legalVersionHistory";

const tabs = [{ key: "version", label: "Working version" }, { key: "email", label: "Policy updated email" }, { key: "history", label: "History and compare" }] as const;

export function LegalDocumentWorkspace({ documentKey }: { readonly documentKey: string }) {
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("version");
  const permissions = useAdminPermissions();
  const { data, errorMessage, isLoading, reload } = useAdminQuery((signal) => fetchLegalDocumentDetail(documentKey, signal), documentKey);
  if (isLoading && !data) return <LoadingBlock label="Loading the document" />;
  if (errorMessage || !data) return <ErrorBlock variant="section" message={errorMessage ?? "Document not found."} onRetry={reload} />;
  const { document, versions } = data;
  const emailVersion = document.openVersion ?? document.currentVersion;
  return (
    <>
      <PageHeader area="Legal" title={document.title} description="Draft, review and publish. A second Legal admin or a superadmin publishes with step-up, and every action is audited."
        meta={document.currentVersion ? <>Live: v{document.currentVersion.versionNumber}, effective {formatDateOnly(document.currentVersion.effectiveAt)} {document.openVersion ? <StatusBadge status={document.openVersion.status} /> : null}</> : "Nothing published yet"} />
      <SegmentedTabs label="Document sections" items={tabs} activeKey={tab} onChange={setTab} />
      {tab === "version" ? <LegalOpenVersionPanel documentKey={documentKey} currentVersion={document.currentVersion} openVersion={document.openVersion} canEdit={permissions.can("legal.documents.edit")} canPublish={permissions.can("legal.documents.publish")} onChanged={reload} /> : null}
      {tab === "email" ? (emailVersion ? <LegalNoticeDraftPanel versionId={emailVersion.id} canEdit={permissions.canAny("legal.documents.edit", "legal.notices.send")} canSendTest={permissions.can("legal.notices.send")} /> : <p>Start a version first.</p>) : null}
      {tab === "history" ? <LegalVersionHistory documentKey={documentKey} versions={versions} canEdit={permissions.can("legal.documents.edit")} hasOpenVersion={document.openVersion !== null} onChanged={reload} /> : null}
    </>
  );
}
