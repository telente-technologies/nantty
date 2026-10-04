"use client";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { PageHeader } from "@/components/ui/pageHeader";
import { configurationDocumentEndpoint } from "@/services/configurationApi.service";
import type { PlansConfiguration, VerificationPlan } from "@/types/platformConfiguration.type";

import { VersionedDocumentSection } from "../shared/versionedDocumentSection";
import { PlanEditorCard } from "./planEditorCard";
import styles from "./plansEditor.module.css";

const plansEndpoint = configurationDocumentEndpoint<"plans">();
const colorSections = [
  { color: "BLUE", title: "Blue — personal verification (incl. creators)" },
  { color: "GOLD", title: "Gold — business and store verification" },
  { color: "BLACK", title: "Black — government and official" },
] as const;

export function PlansWorkspace() {
  const { can } = useAdminPermissions();
  return (
    <>
      <PageHeader area="Configuration" title="Plans & prices" description="Verification tiers, their perks and Gold dashboard entitlements. Prices live in Regional pricing. Each save is a new version." />
      <VersionedDocumentSection<PlansConfiguration>
        endpoint={plansEndpoint}
        recordId="plans"
        title="Plans & prices"
        canWrite={can("config:plans")}
        renderEditor={(content, updateContent, canWrite) => {
          const updatePlan = (planKey: string, updater: (plan: VerificationPlan) => VerificationPlan) =>
            updateContent((current) => ({ ...current, plans: current.plans.map((plan) => (plan.planKey === planKey ? updater(plan) : plan)) }));
          return (
            <div className={styles.sections}>
              <p className={styles.currencies}>
                Prices moved to <a href="/config/pricing">Regional pricing</a>, the price book go-money charges from.
              </p>
              {colorSections.map((section) => (
                <section key={section.color} className={styles.colorSection} aria-label={section.title}>
                  <h2 className={styles.colorHeading}>{section.title}</h2>
                  {content.plans
                    .filter((plan) => plan.color === section.color)
                    .map((plan) => (
                      <PlanEditorCard key={plan.planKey} plan={plan} canWrite={canWrite} onChange={(updater) => updatePlan(plan.planKey, updater)} />
                    ))}
                </section>
              ))}
            </div>
          );
        }}
      />
    </>
  );
}
