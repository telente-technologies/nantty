"use client";

import { useState } from "react";

import { NoticeBanner } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { SegmentedTabs } from "@/components/ui/tabs";

import { AdCashbackPanel } from "./adCashbackPanel";
import styles from "./adCredit.module.css";
import { IssuedAdCreditsPanel } from "./issuedAdCreditsPanel";

const adCreditTabs = [
  { key: "credits", label: "Issued credit" },
  { key: "cashback", label: "Cashback" },
] as const;

export function AdCreditWorkspace() {
  const [activeTab, setActiveTab] = useState<(typeof adCreditTabs)[number]["key"]>("credits");
  return (
    <>
      <PageHeader area="Ads" title="Ad credit" description="Promotional ad credit and ad-spend cashback. Ad credit is ads-only and can never be withdrawn; a user's own ad balance stays separate." />
      <NoticeBanner title="How ad credit works">
        <ul className={styles.rules}>
          <li>Ads spend credit expiring soonest first, then credit that doesn&apos;t expire, then the user&apos;s ad balance, then card.</li>
          <li>Admin-issued credit may have an expiry date or none. Cashback and refunded credit never expire.</li>
          <li>Cashback is credited when spend settles, only on real-money spend (balance or card), never on spend paid with credit, and it is reversed if that spend is refunded.</li>
          <li>Revoking removes only the unspent remainder. Every change needs a reason and your authenticator code, and is saved to the audit log.</li>
        </ul>
      </NoticeBanner>
      <div className={styles.spacedTop}>
        <SegmentedTabs label="Ad credit views" items={adCreditTabs} activeKey={activeTab} onChange={setActiveTab} />
      </div>
      <div className={styles.spacedTop}>{activeTab === "credits" ? <IssuedAdCreditsPanel /> : <AdCashbackPanel />}</div>
    </>
  );
}
