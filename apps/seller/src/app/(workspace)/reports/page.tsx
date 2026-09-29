import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { reportCatalog } from "@/constants/reportCatalog.constant";

import styles from "@/components/reports/reports.module.css";

export const metadata: Metadata = { title: "Reports" };

const reportGroups = ["Sales", "Tax and stock", "Cash drawer"] as const;

export default function ReportsHubPage() {
  return (
    <PageStack>
      <PageHeader title="Reports" description="Pick a report, set the dates and location, then export to CSV for your accountant." />
      {reportGroups.map((group) => (
        <Panel key={group} title={group}>
          <ul className={styles.reportLinkGrid}>
            {reportCatalog
              .filter((entry) => entry.group === group)
              .map((entry) => (
                <li key={entry.kind}>
                  <Link href={`/reports/${entry.kind}`} className={styles.reportLink}>
                    <span className={styles.reportLinkTitle}>{entry.title}</span>
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
