import { NoticeBanner } from "@/components/ui/feedback";
import { CheckboxField, TextField } from "@/components/ui/formFields";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card } from "@/components/ui/surfaces";
import type { DashboardEntitlement, VerificationPlan } from "@/types/platformConfiguration.type";

import { EditableTextList } from "../shared/configurationFields";
import { DashboardEntitlementsEditor } from "./dashboardEntitlementsEditor";
import styles from "./plansEditor.module.css";

interface PlanEditorCardProps {
  readonly plan: VerificationPlan;
  readonly canWrite: boolean;
  readonly onChange: (updater: (plan: VerificationPlan) => VerificationPlan) => void;
}

export function PlanEditorCard({ plan, canWrite, onChange }: PlanEditorCardProps) {
  const isOfficial = plan.color === "BLACK";
  return (
    <Card
      className={`${styles.planCard} ${styles[`plan${plan.color}`]}`}
      title={
        <span className={styles.planTitle}>
          {plan.displayName}
          <code className={styles.planKey}>{plan.planKey}</code>
        </span>
      }
      actions={
        <>
          <StatusBadge label={plan.badgeVisible ? "Public badge" : "No public badge"} tone={plan.badgeVisible ? "info" : "neutral"} hasDot={false} />
          <StatusBadge label={plan.isPurchasable ? "Sold" : "Not for sale"} tone={plan.isPurchasable ? "success" : "night"} hasDot={false} />
        </>
      }
    >
      <div className={styles.planBody}>
        <div className={styles.planColumn}>
          <TextField label="Name shown to people" value={plan.displayName} disabled={!canWrite} maxLength={40} onChange={(event) => onChange((current) => ({ ...current, displayName: event.target.value }))} />
          {isOfficial ? (
            <NoticeBanner tone="info" title="Never purchasable">
              Black Official is granted only through the manual official process for governments and public institutions. It has no price in any currency.
            </NoticeBanner>
          ) : (
            <CheckboxField label="Available to buy" description="Turning this off hides the plan from checkout. Current subscribers keep it until renewal." checked={plan.isPurchasable} disabled={!canWrite} onChange={(event) => onChange((current) => ({ ...current, isPurchasable: event.target.checked }))} />
          )}
          {plan.tier === "ESSENTIAL" ? <p className={styles.planNote}>Essential never shows a badge, even when verified.</p> : null}
          <EditableTextList label="Perks" items={plan.perks} placeholder="e.g. Priority support" isDisabled={!canWrite} onChange={(perks) => onChange((current) => ({ ...current, perks }))} />
          {plan.color === "GOLD" ? <DashboardEntitlementsEditor entitlements={plan.dashboardEntitlements} canWrite={canWrite} onChange={(dashboardEntitlements: DashboardEntitlement[]) => onChange((current) => ({ ...current, dashboardEntitlements }))} /> : null}
        </div>
        {plan.isPurchasable ? (
          <div className={styles.planColumn}>
            <p className={styles.planNote}>
              Prices for every region, web and app store are set in <a href="/config/pricing">Regional pricing</a>.
            </p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
