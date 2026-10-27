"use client";

import Link from "next/link";
import { useState } from "react";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, KeyValueList, TwoColumnLayout } from "@/components/ui/surfaces";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchVerificationApplicationDetail } from "@/services/peopleReviewsApi.service";
import type { VerificationAutomatedCheck, VerificationDocumentSummary } from "@/types/verification.type";
import { formatDateTime, formatMoneyForDisplay, humanizeConstantName } from "@/utils/formatting.util";

import { VerificationDecisionPanel } from "./verificationDecisionPanel";
import { VerificationDocumentViewer } from "./verificationDocumentViewer";
import { VerificationTierLabel } from "./verificationTierLabel";
import styles from "./peopleWorkspace.module.css";
import { NanttyIcon } from "@/components/ui/nanttyIcon";
import type { NanttyIconName } from "@/constants/nanttyIconNames.constant";

const checkSymbols: Record<VerificationAutomatedCheck["result"], { icon: NanttyIconName; className: string; label: string }> = {
  PASS: { icon: "check16", className: styles.checkPass ?? "", label: "Passed" },
  FAIL: { icon: "cancel20", className: styles.checkFail ?? "", label: "Failed" },
  REVIEW: { icon: "warning20", className: styles.checkReview ?? "", label: "Needs review" },
};

export function VerificationDetailWorkspace({ verificationId }: { readonly verificationId: string }) {
  const { can } = useAdminPermissions();
  const [openDocument, setOpenDocument] = useState<VerificationDocumentSummary | null>(null);
  const { data: application, errorMessage, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchVerificationApplicationDetail(verificationId, signal), verificationId);

  if (errorMessage) return <ErrorBlock variant="section" message={errorMessage} onRetry={reload} />;
  if (isLoading || !application) return <LoadingBlock lines={8} />;
  const canViewDocuments = can("verification:documents");

  return (
    <>
      <PageHeader
        area="People · Verification"
        title={<VerificationTierLabel color={application.color} tier={application.tier} />}
        meta={
          <>
            <StatusBadge status={application.status} />
            <UserIdentity user={application.user} size={22} />
            <Link href={`/users/${application.user.id}`}>Open user</Link>
            <span className="mono">{application.id}</span>
          </>
        }
      />
      <TwoColumnLayout
        main={
          <>
            <Card title="Applicant">
              <KeyValueList
                columns={2}
                items={[
                  { label: "Legal name", value: application.applicant.legalName },
                  { label: "Category", value: application.applicant.category },
                  { label: "Country", value: application.applicant.country },
                  { label: "Subject", value: humanizeConstantName(application.subjectKind) },
                  ...(application.applicant.businessName ? [{ label: "Business", value: application.applicant.businessName }, { label: "Registration", value: application.applicant.registrationNumber ?? "—", isMono: true }] : []),
                  ...(application.applicant.agencyName ? [{ label: "Agency", value: application.applicant.agencyName }, { label: "Official contact", value: application.applicant.officialContactEmail ?? "—", isMono: true }] : []),
                  { label: "Plan", value: application.subscription ? `${application.subscription.planCode} · ${formatMoneyForDisplay(application.subscription.price)}/month` : "Not purchasable" },
                  { label: "Submitted", value: formatDateTime(application.submittedAt) },
                ]}
              />
            </Card>
            <Card title="Automated checks">
              <ul className={styles.checkList}>
                {application.checks.map((check) => {
                  const symbol = checkSymbols[check.result];
                  return (
                    <li key={check.label} className={styles.check}>
                      <span className={symbol.className} aria-label={symbol.label}><NanttyIcon name={symbol.icon} size={14} /></span>
                      <span>
                        <strong>{check.label}</strong>
                        <br />
                        <span className={styles.checkDetail}>{check.detail}</span>
                      </span>
                      <StatusBadge status={check.result === "PASS" ? "APPROVED" : check.result === "FAIL" ? "FAILED" : "IN_REVIEW"} label={symbol.label} />
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card title="Documents">
              <ul className={styles.list}>
                {application.documents.map((document) => (
                  <li key={document.id} className={styles.listItem}>
                    <span>
                      <strong>{document.label}</strong>
                      <br />
                      <span className={styles.faint}>Uploaded {formatDateTime(document.uploadedAt)}</span>
                    </span>
                    {canViewDocuments ? (
                      <Button size="small" iconName="eye16" onClick={() => setOpenDocument(document)}>View</Button>
                    ) : (
                      <span className={styles.faint}>No permission</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </>
        }
        aside={
          <>
            <VerificationDecisionPanel application={application} onUpdated={(updated) => replaceData(() => updated)} />
            <Card title="History">
              <AuditHistoryList entries={application.history} emptyMessage="No decisions yet." />
            </Card>
          </>
        }
      />
      {openDocument ? <VerificationDocumentViewer application={application} document={openDocument} onClose={() => setOpenDocument(null)} /> : null}
    </>
  );
}
