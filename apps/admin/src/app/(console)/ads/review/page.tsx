import type { Metadata } from "next";

import { AdsReviewWorkspace } from "@/components/trust/adsReviewWorkspace";

export const metadata: Metadata = { title: "Ads review" };

export default function AdsReviewPage() {
  return <AdsReviewWorkspace />;
}
