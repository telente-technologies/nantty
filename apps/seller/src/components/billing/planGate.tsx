"use client";

import type { ReactNode } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { ButtonLink } from "@/components/ui/button";
import { NanttyIcon } from "@/components/ui/nanttyIcon";
import { paidPlanCheckmarkNote, planFeatureDescriptions, sellerPlanLabels, type PlanFeature, type SellerPlan } from "@/config/planFeatures.config";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";

import styles from "./planGate.module.css";

export function PlanBadge({ plan }: { readonly plan: SellerPlan }) {
  if (plan === "free") return null;
  return (
    <span className={`${styles.badge} ${plan === "business" ? styles.badgeBusiness : ""}`} title={`Included in ${sellerPlanLabels[plan]}`}>
      <NanttyIcon name="star16" size={10} /> {sellerPlanLabels[plan]}
    </span>
  );
}

export function FeaturePlanBadge({ feature }: { readonly feature: PlanFeature }) {
  const { hasFeature, readRequiredPlan } = usePlanFeatures();
  if (hasFeature(feature)) return null;
  return <PlanBadge plan={readRequiredPlan(feature)} />;
}

export function UpgradePlanLink({ feature, size = "small" }: { readonly feature: PlanFeature; readonly size?: "small" | "medium" }) {
  const { can } = useSellerSession();
  const { readRequiredPlan } = usePlanFeatures();
  const requiredPlanLabel = sellerPlanLabels[readRequiredPlan(feature)];
  if (!can("billing:manage")) return <span className={styles.lockedHint}>Ask the store owner to upgrade to {requiredPlanLabel}.</span>;
  return (
    <ButtonLink href={`/settings/billing?feature=${feature}`} variant="primary" size={size} iconName="star16">
      Upgrade to {requiredPlanLabel}
    </ButtonLink>
  );
}

export function PlanLockedNotice({ feature, compact = false, description }: { readonly feature: PlanFeature; readonly compact?: boolean; readonly description?: ReactNode }) {
  const { readRequiredPlan } = usePlanFeatures();
  const copy = planFeatureDescriptions[feature];
  return (
    <div className={`${styles.locked} ${compact ? styles.lockedCompact : ""}`} role="note">
      <div className={styles.lockedHeader}>
        <NanttyIcon name="shield24" size={18} />
        <span className={styles.lockedTitle}>{copy.title}</span>
        <PlanBadge plan={readRequiredPlan(feature)} />
      </div>
      <p className={styles.lockedDescription}>{description ?? copy.description}</p>
      <p className={styles.lockedHint}>Pro and Business also include the {paidPlanCheckmarkNote.charAt(0).toLowerCase()}{paidPlanCheckmarkNote.slice(1)}.</p>
      <UpgradePlanLink feature={feature} />
    </div>
  );
}

export function PlanGate({ feature, children, compact = false, description }: { readonly feature: PlanFeature; readonly children: ReactNode; readonly compact?: boolean; readonly description?: ReactNode }) {
  const { hasFeature } = usePlanFeatures();
  if (hasFeature(feature)) return <>{children}</>;
  return <PlanLockedNotice feature={feature} compact={compact} description={description} />;
}
