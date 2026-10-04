"use client";

import { useState } from "react";

import { PageHeader } from "@/components/ui/pageHeader";
import { SegmentedTabs } from "@/components/ui/tabs";

import { CoinPackPricePanel } from "./coinPackPricePanel";
import { PlanPriceBookPanel } from "./planPriceBookPanel";
import { RegionalAdPricingPanel } from "./regionalAdPricingPanel";
import styles from "./regionalPricing.module.css";

type PricingTab = "plans" | "coins" | "ads";

const tabs = [
  { key: "plans" as const, label: "Plans & checkmarks" },
  { key: "coins" as const, label: "Coin packs" },
  { key: "ads" as const, label: "Ads, boosts & creator bands" },
];

export function RegionalPricingWorkspace() {
  const [activeTab, setActiveTab] = useState<PricingTab>("plans");
  return (
    <>
      <PageHeader
        area="Configuration"
        title="Regional pricing"
        description="Prices per region (NG, GH, KE, ZA, GB, EU, US) for web, iOS and Android. Any other country pays the US price in USD. Every change asks for a reason and is written to the audit log with your name. The creator ad revenue share is the same in every region."
      />
      <div className={styles.sections}>
        <SegmentedTabs label="Pricing area" items={tabs} activeKey={activeTab} onChange={setActiveTab} />
        {activeTab === "plans" ? <PlanPriceBookPanel /> : null}
        {activeTab === "coins" ? <CoinPackPricePanel /> : null}
        {activeTab === "ads" ? <RegionalAdPricingPanel /> : null}
      </div>
    </>
  );
}
