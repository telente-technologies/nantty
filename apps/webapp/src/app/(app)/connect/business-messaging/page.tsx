import type { Metadata } from "next";
import { Suspense } from "react";

import { BusinessMessagingConsentView } from "@/components/settings/businessMessagingConsentView";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import styles from "@/components/settings/settings.module.css";

export const metadata: Metadata = { title: "Review business app access" };

export default function BusinessMessagingConsentPage() {
  return <main className={styles.page}>
    <Suspense fallback={<ListRowsSkeleton label="Loading business app request" rows={2} withAvatar={false} />}>
      <BusinessMessagingConsentView />
    </Suspense>
  </main>;
}
