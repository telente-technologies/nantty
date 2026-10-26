"use client";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { PageHeader } from "@/components/ui/pageHeader";
import { configurationDocumentEndpoint } from "@/services/configurationApi.service";
import type { RevenueRulesConfiguration } from "@/types/platformConfiguration.type";

import { VersionedDocumentSection } from "../shared/versionedDocumentSection";
import { RevenueRulesEditor } from "./revenueRulesEditor";

const revenueEndpoint = configurationDocumentEndpoint<"revenue">();

export function RevenueRulesWorkspace() {
  const { can } = useAdminPermissions();
  return (
    <>
      <PageHeader area="Configuration" title="Revenue rules" description="How money is shared between creators, sellers and Nantty. Rates are stored in basis points; amounts are per currency. Changes apply to new transactions only." />
      <VersionedDocumentSection<RevenueRulesConfiguration>
        endpoint={revenueEndpoint}
        recordId="revenue"
        title="Revenue rules"
        canWrite={can("config:revenue")}
        renderEditor={(content, updateContent, canWrite) => <RevenueRulesEditor rules={content} canWrite={canWrite} onChange={updateContent} />}
      />
    </>
  );
}
