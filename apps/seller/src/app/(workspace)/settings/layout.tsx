import type { ReactNode } from "react";

import { SettingsSectionTabs } from "@/components/settings/settingsSectionTabs";
import { PageHeader, PageStack } from "@/components/ui/panel";

export default function SettingsLayout({ children }: { readonly children: ReactNode }) {
  return (
    <PageStack>
      <PageHeader title="Settings" description="Your store, account, security, notifications, payouts, team, developers and integrations." />
      <SettingsSectionTabs />
      {children}
    </PageStack>
  );
}
