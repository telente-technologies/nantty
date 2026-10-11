"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
import { ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { Card, KeyValueList } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchBrandDetail } from "@/services/brandsApi.service";
import type { BrandDetail } from "@/types/brands.type";
import { formatDateOnly } from "@/utils/formatting.util";

import { BrandLinkedStoresTable, BrandMembersTable } from "./brandPeopleAndStores";
import { BrandLogo, OfficialStatusBadge } from "./brandLabels";
import styles from "./brands.module.css";
import { ipClaimColumns } from "./ipClaimColumns";
import { OfficialStorePanel } from "./officialStorePanel";

type BrandTab = "profile" | "members" | "stores" | "official" | "claims" | "history";

export function BrandDetailWorkspace({ brandId }: { readonly brandId: string }) {
  const router = useRouter();
  const detail = useAdminQuery((signal) => fetchBrandDetail(brandId, signal), brandId);
  const [activeTab, setActiveTab] = useState<BrandTab>("official");
  const brand = detail.data;

  function replaceBrand(updated: BrandDetail) {
    detail.replaceData(() => updated);
  }

  if (detail.errorMessage) return <ErrorBlock variant="section" error={detail.error} message={detail.errorMessage} onRetry={detail.reload} />;
  if (!brand) return <LoadingBlock lines={6} />;
  const tabs = [
    { key: "official" as const, label: "Official Store" },
    { key: "profile" as const, label: "Profile" },
    { key: "members" as const, label: "Members", count: brand.members.length },
    { key: "stores" as const, label: "Linked stores", count: brand.linkedStores.length },
    { key: "claims" as const, label: "Claims filed", count: brand.claimsFiled.length },
    { key: "history" as const, label: "History" },
  ];
  return (
    <>
      <PageHeader
        area="People · brands"
        title={<span className={styles.headerIdentity}><BrandLogo name={brand.name} logoUrl={brand.logoUrl} size={40} />{brand.name}</span>}
        description={brand.description}
        meta={<><OfficialStatusBadge status={brand.officialStatus} /><span className={styles.muted}>{brand.category} · {brand.country} · <code>{brand.id}</code></span></>}
        actions={<ButtonLink href="/brands" variant="ghost" iconName="arrowLeft24">All brands</ButtonLink>}
      />
      <SegmentedTabs label="Brand sections" items={tabs} activeKey={activeTab} onChange={setActiveTab} />
      {activeTab === "official" ? <OfficialStorePanel brand={brand} onChanged={replaceBrand} /> : null}
      {activeTab === "profile" ? (
        <Card title="Profile">
          <KeyValueList
            columns={3}
            items={[
              { label: "Slug", value: brand.slug, isMono: true },
              { label: "Website", value: brand.website ?? "—" },
              { label: "Status", value: brand.status },
              { label: "Owner", value: brand.owner ? <UserIdentity user={brand.owner} size={24} /> : "—" },
              { label: "Created", value: formatDateOnly(brand.createdAt) },
              { label: "Open claims", value: brand.openClaimCount },
            ]}
          />
        </Card>
      ) : null}
      {activeTab === "members" ? <BrandMembersTable members={brand.members} /> : null}
      {activeTab === "stores" ? <BrandLinkedStoresTable stores={brand.linkedStores} /> : null}
      {activeTab === "claims" ? <DataTable caption="Claims filed by this brand" columns={ipClaimColumns} rows={brand.claimsFiled} readRowKey={(claim) => claim.id} onRowOpen={(claim) => router.push(`/ip-claims/${encodeURIComponent(claim.id)}`)} emptyMessage="This brand has not filed any claims." /> : null}
      {activeTab === "history" ? <Card title="Admin history"><AuditHistoryList entries={brand.history} /></Card> : null}
    </>
  );
}
