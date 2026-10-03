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
      <PageHeader area="Configuration" title="Plans & prices" description="Verification tiers, their perks, Gold dashboard entitlements and prices in every supported currency. Each save is a new version." />
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
                Supported currencies: {content.supportedCurrencies.map((currency) => <code key={currency}>{currency}</code>)}
              </p>
              {colorSections.map((section) => (
                <section key={section.color} className={styles.colorSection} aria-label={section.title}>
                  <h2 className={styles.colorHeading}>{section.title}</h2>
                  {content.plans
                    .filter((plan) => plan.color === section.color)
                    .map((plan) => (
                      <PlanEditorCard key={plan.planKey} plan={plan} supportedCurrencies={content.supportedCurrencies} canWrite={canWrite} onChange={(updater) => updatePlan(plan.planKey, updater)} />
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
