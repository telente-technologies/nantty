"use client";

import { useState } from "react";

import { AffiliateCatalogPanel } from "@/components/affiliates/affiliateCatalogPanel";
import { AffiliateEarningsPanel } from "@/components/affiliates/affiliateEarningsPanel";
import { AffiliatePromotionsPanel } from "@/components/affiliates/affiliatePromotionsPanel";
import { SegmentedControl } from "@/components/ui/controls";
import { PageHeader, pageStyles } from "@/components/ui/studioPage";

type AffiliateSection = "catalog" | "promoting" | "earnings";

const sections = [
  { value: "catalog", label: "Products I can promote" },
  { value: "promoting", label: "Products I'm promoting" },
  { value: "earnings", label: "Earnings" },
] as const;

export default function AffiliatesPage() {
  const [section, setSection] = useState<AffiliateSection>("catalog");
  return (
    <div className={pageStyles.page}>
      <PageHeader
        title="Affiliate"
        subtitle="Promote products from stores running an affiliate programme. Share your link or tag the product in posts, clips and lives, and earn commission when a buyer's order completes."
      />
      <SegmentedControl label="Affiliate sections" options={sections} value={section} onChange={setSection} />
      {section === "catalog" ? <AffiliateCatalogPanel /> : null}
      {section === "promoting" ? <AffiliatePromotionsPanel /> : null}
      {section === "earnings" ? <AffiliateEarningsPanel /> : null}
    </div>
  );
}
