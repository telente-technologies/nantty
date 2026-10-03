import type { Metadata } from "next";

import { AdsSummaryView } from "@/components/ads/adsSummaryView";
import { readAdsManagerUrl } from "@/config/siteMetadata.config";

export const metadata: Metadata = { title: "Ads" };

export default function AdsPage() {
  return <AdsSummaryView adsManagerUrl={readAdsManagerUrl()} />;
}
