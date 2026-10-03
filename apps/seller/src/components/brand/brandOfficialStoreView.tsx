"use client";

import { useState } from "react";

import { useBrandWorkspace } from "@/components/brand/brandWorkspace";
import { Button } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { OfficialStoreDetails } from "@/types/brand.type";
import { officialStoreLabels } from "@/utils/brandPresentation.util";

import styles from "./brand.module.css";
import { ZudoIcon } from "@/components/ui/zudoIcon";

const officialStoreBenefits = [
  "An Official Store badge on your store, products and brand page",
  "Your listings rank first when buyers search for your brand",
  "Brand protection: see who else lists your brand and report counterfeits",
];

export function BrandOfficialStoreView() {
  const { brand, myRole, myStores, canEditDashboardSettings, reloadBrand } = useBrandWorkspace();
  const { showToast } = useToast();
  const detailsQuery = useSellerQuery<OfficialStoreDetails>(`/seller/brands/${encodeURIComponent(brand.id)}/official-store`);
  const [isApplying, setIsApplying] = useState(false);
  const details = detailsQuery.data;

  async function applyForOfficialStore() {
    setIsApplying(true);
    try {
      detailsQuery.replaceData(() => null);
      await sendSellerApiRequest<OfficialStoreDetails>(`/seller/brands/${encodeURIComponent(brand.id)}/official-store/apply`, { method: "POST", body: {} });
      showToast(`${brand.name} is now an Official Store.`);
      reloadBrand();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      detailsQuery.reload();
      setIsApplying(false);
    }
  }

  if (detailsQuery.isLoading && !details) return <LoadingBlock label="Checking Official Store status" />;
  if (!details) return <Callout tone="error">{detailsQuery.errorMessage ?? "Official Store status could not be loaded."}</Callout>;
  const status = officialStoreLabels[details.officialStore.status];
  const officialStoreName = myStores.find((store) => store.storeId === (details.officialStore.storeId ?? details.candidateStoreId))?.storeName;

  return (
    <div className={styles.twoColumns}>
      <Panel title="Official Store" actions={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>} description="Only registered brands selling through a Gold-verified store can become an Official Store.">
        {details.officialStore.status === "active" ? (
          <Callout tone="success" title={`${officialStoreName ?? "Your store"} is the Official Store for ${brand.name}`}>Buyers see the Official Store badge, and brand protection is switched on.</Callout>
        ) : details.officialStore.status === "suspended" ? (
          <Callout tone="error" title="The badge is paused">{details.officialStore.reason ?? "A requirement below is no longer met."}</Callout>
        ) : details.officialStore.status === "eligible" ? (
          <Callout tone="info" title="You meet every requirement">Apply now and the badge appears on {officialStoreName ?? "your store"} once Zudomart confirms it.</Callout>
        ) : (
          <Callout tone="caution" title="A few steps to go">Finish the unticked items below, then come back to apply.</Callout>
        )}
        <ul className={styles.checklist} style={{ marginTop: 12 }}>
          {details.requirements.map((requirement) => (
            <li key={requirement.key} className={styles.checkItem}>
              <span className={`${styles.checkMark} ${requirement.met ? styles.checkMarkMet : ""}`} aria-hidden="true">{requirement.met ? <ZudoIcon name="check16" size={14} /> : null}</span>
              <div>
                <p className={styles.checkLabel}>
                  {requirement.label} <span className="visuallyHidden">{requirement.met ? "(done)" : "(not done yet)"}</span>
                </p>
                {!requirement.met ? <p className={styles.muted}>{requirement.howToFix}</p> : null}
              </div>
            </li>
          ))}
        </ul>
        {details.officialStore.status === "eligible" ? (
          myRole === "owner" && canEditDashboardSettings ? (
            <div className={styles.actionsRow}>
              <Button variant="primary" isBusy={isApplying} onClick={() => void applyForOfficialStore()}>Apply for Official Store</Button>
            </div>
          ) : (
            <p className={styles.muted}>Only the brand owner can apply.</p>
          )
        ) : null}
      </Panel>
      <Panel title="What you get">
        <ul className={styles.checklist}>
          {officialStoreBenefits.map((benefit) => (
            <li key={benefit} className={styles.checkItem}>
              <span className={`${styles.checkMark} ${styles.checkMarkMet}`} aria-hidden="true"><ZudoIcon name="check16" size={14} /></span>
              <p>{benefit}</p>
            </li>
          ))}
        </ul>
        <p className={styles.muted} style={{ marginTop: 12 }}>How to get it: register the brand in the Zudomart app with your trademark or CAC documents, sell through a Gold-verified store linked to the brand, and keep Gold Pro or Gold Premium active.</p>
      </Panel>
    </div>
  );
}
