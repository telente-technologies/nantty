"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PayoutSetupBanner } from "@/components/payouts/payoutSetupBanner";
import { PageHeader } from "@/components/ui/studioPage";

import styles from "./hub.module.css";

const TABS = [
  { href: "/lives", label: "Go live" },
  { href: "/lives/scheduled", label: "Scheduled" },
  { href: "/lives/replays", label: "Replays" },
] as const;

export default function GoLiveHubLayout({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className={styles.page}>
      <PageHeader title="Go live" subtitle="Stream from this browser or OBS, plan lives ahead, and rewatch past ones." />
      <PayoutSetupBanner />
      <nav aria-label="Go live sections" className={styles.tabs}>
        {TABS.map((tab) => (
          <Link key={tab.href} href={tab.href} className={styles.tab} aria-current={pathname === tab.href ? "page" : undefined}>
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
