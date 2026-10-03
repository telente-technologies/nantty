"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modalDialog";
import { privacyService } from "@/services/privacy.service";
import type { PolicyVersionSummary } from "@/types/policyUpdate.type";

import styles from "./policyUpdateHost.module.css";
import { usePolicyUpdates } from "./usePolicyUpdates.hook";

function formatDate(isoText: string): string {
  return new Date(isoText).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function describeUpdatedDocuments(versions: readonly PolicyVersionSummary[]): string {
  return versions.map((version) => version.title).join(" and ");
}

function SummaryDialog({ version, isOpen, onClose, onAccept, isAccepting, errorMessage }: { readonly version: PolicyVersionSummary; readonly isOpen: boolean; readonly onClose: () => void; readonly onAccept: () => void; readonly isAccepting: boolean; readonly errorMessage: string | null }) {
  return (
    <ModalDialog isOpen={isOpen} title={`${version.title} updated`} description={`Version ${version.versionLabel}, effective ${formatDate(version.effectiveAt)}`} onClose={onClose}
      footer={<Button busy={isAccepting} onClick={onAccept}>{version.isMaterialChange ? "Accept update" : "Got it"}</Button>}>
      <p>{version.summary}</p>
      {version.isMaterialChange ? <p className={styles.muted}>This is a material change. Please accept it by {formatDate(version.effectiveAt)} to keep using Zudomart.</p> : null}
      <p><a href={version.documentUrl} target="_blank" rel="noreferrer">Read the full {version.title}</a></p>
      {errorMessage ? <p className={styles.error} role="alert">{errorMessage}</p> : null}
    </ModalDialog>
  );
}

function BlockingReacceptScreen({ version, onAccept, isAccepting, errorMessage }: { readonly version: PolicyVersionSummary; readonly onAccept: () => void; readonly isAccepting: boolean; readonly errorMessage: string | null }) {
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  async function requestExport() {
    try {
      await privacyService.requestMyDataExport();
      setExportMessage("We are preparing your data. We will email you when it is ready.");
    } catch {
      setExportMessage("We could not start the export. Try again in a moment.");
    }
  }
  return (
    <div className={styles.blocker} role="alertdialog" aria-modal="true" aria-labelledby="reaccept-title">
      <div className={styles.blockerCard}>
        <h1 id="reaccept-title" className={styles.blockerTitle}>Please review our updated {version.title}</h1>
        <p>{version.summary}</p>
        <p className={styles.muted}>Effective {formatDate(version.effectiveAt)}. To keep using Zudomart you need to accept it. <a href={version.documentUrl} target="_blank" rel="noreferrer">Read the full document</a>.</p>
        <Button fullWidth busy={isAccepting} onClick={onAccept}>Accept and continue</Button>
        {errorMessage ? <p className={styles.error} role="alert">{errorMessage}</p> : null}
        <div className={styles.alternatives}>
          <p className={styles.muted}>Do not agree? You can take your data and leave.</p>
          <Button variant="secondary" onClick={() => void requestExport()}>Download my data</Button>
          <a className={styles.deleteLink} href="/settings/privacy">Delete my account</a>
          {exportMessage ? <p className={styles.muted} role="status">{exportMessage}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function PolicyUpdateHost() {
  const { isSignedIn, blocking, bannerVersions, dismiss, accept, isAccepting, acceptErrorMessage } = usePolicyUpdates();
  const [openedId, setOpenedId] = useState<string | null>(null);
  if (!isSignedIn) return null;
  if (blocking) return <BlockingReacceptScreen version={blocking} onAccept={() => void accept(blocking)} isAccepting={isAccepting} errorMessage={acceptErrorMessage} />;
  const opened = bannerVersions.find((version) => version.policyVersionId === openedId) ?? null;
  if (bannerVersions.length === 0) return null;
  const first = bannerVersions[0] as PolicyVersionSummary;
  return (
    <>
      <div className={styles.banner} role="status">
        <p className={styles.bannerText}>We&apos;ve updated our {describeUpdatedDocuments(bannerVersions)}.</p>
        <Button size="sm" variant="secondary" onClick={() => setOpenedId(first.policyVersionId)}>See what changed</Button>
        <button type="button" className={styles.dismiss} onClick={() => bannerVersions.forEach((version) => dismiss(version.policyVersionId))} aria-label="Dismiss this notice">×</button>
      </div>
      {opened ? <SummaryDialog version={opened} isOpen onClose={() => setOpenedId(null)} isAccepting={isAccepting} errorMessage={acceptErrorMessage} onAccept={async () => { await accept(opened); setOpenedId(null); }} /> : null}
    </>
  );
}
