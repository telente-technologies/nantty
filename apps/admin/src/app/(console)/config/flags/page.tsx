import type { Metadata } from "next";

import { FeatureFlagsWorkspace } from "@/components/configuration/flags/featureFlagsWorkspace";

export const metadata: Metadata = { title: "Feature flags" };

export default function FeatureFlagsPage() {
  return <FeatureFlagsWorkspace />;
}
