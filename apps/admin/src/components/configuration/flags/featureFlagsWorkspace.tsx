"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { PageHeader } from "@/components/ui/pageHeader";
import { SegmentedTabs } from "@/components/ui/tabs";

import { ExperimentsTab } from "./experimentsTab";
import { FeatureFlagsTab } from "./featureFlagsTab";

const tabs = [
  { key: "flags", label: "Feature flags" },
  { key: "experiments", label: "Experiments" },
] as const;

export function FeatureFlagsWorkspace() {
  const { can } = useAdminPermissions();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>("flags");
  const canWrite = can("flags:manage");
  return (
    <>
      <PageHeader area="Configuration" title="Feature flags & experiments" description="Turn features on gradually, stop them in an emergency, and run A/B tests. Every change is versioned and needs your authenticator code." />
      <SegmentedTabs label="Flags or experiments" items={tabs} activeKey={activeTab} onChange={setActiveTab} />
      {activeTab === "flags" ? <FeatureFlagsTab canWrite={canWrite} /> : <ExperimentsTab canWrite={canWrite} />}
    </>
  );
}
