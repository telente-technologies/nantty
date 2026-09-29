import type { ReactNode } from "react";

import { SettingsSectionTabs } from "@/components/settings/settingsSectionTabs";
import { PageHeader, PageStack } from "@/components/ui/panel";

export default function SettingsLayout({ children }: { readonly children: ReactNode }) {
  return (
    <PageStack>
      <PageHeader title="Settings" description="How your store, registers, receipts and payments work." />
      <SettingsSectionTabs />
      {children}
    </PageStack>
  );
}
