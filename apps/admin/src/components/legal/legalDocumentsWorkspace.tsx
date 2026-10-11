"use client";

import { useRouter } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchLegalDocuments } from "@/services/legalApi.service";
import type { LegalDocumentSummary } from "@/types/legal.type";
import { formatDateOnly } from "@/utils/formatting.util";

const columns: readonly DataTableColumn<LegalDocumentSummary>[] = [
  { key: "title", header: "Document", render: (document) => <strong>{document.title}</strong> },
  { key: "current", header: "Live version", render: (document) => (document.currentVersion ? `v${document.currentVersion.versionNumber}` : "None") },
  { key: "effective", header: "Effective", render: (document) => (document.currentVersion ? formatDateOnly(document.currentVersion.effectiveAt) : "") },
  { key: "open", header: "In progress", render: (document) => (document.openVersion ? <><StatusBadge status={document.openVersion.status} /> v{document.openVersion.versionNumber}</> : "") },
  { key: "count", header: "Versions", align: "end", render: (document) => document.versionCount },
];

export function LegalDocumentsWorkspace() {
  const router = useRouter();
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchLegalDocuments(signal), "legal-documents");
  return (
    <>
      <PageHeader area="Legal" title="Legal documents" description="Terms, privacy and every other policy users agree to. Each change is a new version with a summary, an effective date and a second-person publish." actions={<ButtonLink href="/legal/notices">Policy notices</ButtonLink>} />
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Legal documents" columns={columns} rows={data?.items ?? []} readRowKey={(document) => document.key} onRowOpen={(document) => router.push(`/legal/${document.key}`)} isLoading={isLoading} />
    </>
  );
}
