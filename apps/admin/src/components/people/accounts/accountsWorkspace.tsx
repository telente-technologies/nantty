"use client";

import { useState } from "react";

import { PageHeader } from "@/components/ui/pageHeader";
import { SegmentedTabs } from "@/components/ui/tabs";
import { useAdminPermissions } from "@/components/session/adminSessionProvider";

import { CheckmarkGrantsPanel } from "./checkmarkGrantsPanel";
import { CreatedAccountsPanel } from "./createdAccountsPanel";

const tabs = [{ key: "CREATED", label: "Created accounts" }, { key: "CHECKMARKS", label: "Free checkmarks" }] as const;

export function getInitialAccountsTab(canGrant: boolean): (typeof tabs)[number]["key"] {
  return canGrant ? "CREATED" : "CHECKMARKS";
}

export function AccountsWorkspace() {
  const { can } = useAdminPermissions();
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>(() => getInitialAccountsTab(can("verification:grant")));
  return (
    <>
      <PageHeader area="People" title="Accounts" description="Create official accounts with a chosen username and grant lifetime free checkmarks. Every action needs your authenticator code and is audited." />
      <SegmentedTabs label="Account tools" items={tabs} activeKey={tab} onChange={setTab} />
      {tab === "CREATED" ? <CreatedAccountsPanel /> : <CheckmarkGrantsPanel />}
    </>
  );
}
