import type { ReactNode } from "react";

import { LinkTabs } from "@/components/ui/navigationTabs";
import { PageHeader, PageStack } from "@/components/ui/panel";

const affiliateTabs = [
  { href: "/affiliates", label: "Overview", exact: true },
  { href: "/affiliates/requests", label: "Requests" },
  { href: "/affiliates/creators", label: "Creators" },
  { href: "/affiliates/commissions", label: "Commissions" },
  { href: "/affiliates/live", label: "Live selling" },
];

export default function AffiliatesLayout({ children }: { readonly children: ReactNode }) {
  return (
    <PageStack>
      <PageHeader
        title="Affiliates & creators"
        description="Creators in the Nantty Creator Program sell your products in posts, clips and lives. They earn a commission, paid automatically when escrow is released."
      />
      <LinkTabs label="Affiliate sections" tabs={affiliateTabs} />
      {children}
    </PageStack>
  );
}
