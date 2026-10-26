"use client";

import Link from "next/link";

import { FeaturePlanBadge } from "@/components/billing/planGate";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { reportCatalog, reportGroups } from "@/constants/reportCatalog.constant";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";

import styles from "./reports.module.css";

const reportGroupDescriptions: Record<(typeof reportGroups)[number], string> = {
  Sales: "Revenue from orders placed in the Nantty app.",
  Orders: "How quickly orders move and where they end up.",
  Inventory: "What your stock is worth and what to reorder.",
  Customers: "Who buys from you and who comes back.",
  Products: "What sells and what sits on the shelf.",
  Financial: "Settlements, fees, refunds and payouts for your accountant.",
  Ads: "What your Ads Manager campaigns bring in.",
};

export function ReportsHubView() {
  const { hasFeature } = usePlanFeatures();
  const hasAdvancedReports = hasFeature("advanced_reports");
  return (
    <PageStack>
      <PageHeader title="Reports" description="Pick a report, set the dates, then download it as CSV, Excel or PDF for your accountant." />
      {reportGroups.map((group) => (
        <Panel key={group} title={group} description={reportGroupDescriptions[group]}>
          <ul className={styles.reportLinkGrid}>
            {reportCatalog
              .filter((entry) => entry.group === group)
              .map((entry) => (
                <li key={entry.kind}>
                  <Link href={`/reports/${entry.kind}`} className={`${styles.reportLink} ${entry.needsAdvancedReports && !hasAdvancedReports ? styles.reportLinkLocked : ""}`}>
                    <span className={styles.reportLinkTitle}>
                      {entry.title}
                      {entry.needsAdvancedReports ? <FeaturePlanBadge feature="advanced_reports" /> : null}
                    </span>
                    <span className={styles.reportLinkDescription}>{entry.description}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </Panel>
      ))}
    </PageStack>
  );
}
