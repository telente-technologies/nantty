"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { CursorPagination } from "@/components/ui/pagination";
import { Toolbar } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchBrandDirectory } from "@/services/brandsApi.service";
import type { BrandSummary } from "@/types/brands.type";
import { formatRelativeTimeFromNow } from "@/utils/formatting.util";

import { BrandNameCell, OfficialStatusBadge } from "./brandLabels";

type OfficialFilter = "" | "PENDING" | "NEEDS_INFO" | "OFFICIAL" | "REVOKED" | "NONE";

const officialTabs: readonly { key: OfficialFilter; label: string }[] = [
  { key: "", label: "All brands" },
  { key: "PENDING", label: "Review pending" },
  { key: "NEEDS_INFO", label: "Needs info" },
  { key: "OFFICIAL", label: "Official Stores" },
  { key: "REVOKED", label: "Revoked" },
  { key: "NONE", label: "Not requested" },
];

const columns: readonly DataTableColumn<BrandSummary>[] = [
  { key: "brand", header: "Brand", render: (brand) => <BrandNameCell name={brand.name} logoUrl={brand.logoUrl} subtitle={`${brand.category} · ${brand.country}`} /> },
  { key: "owner", header: "Owner", render: (brand) => (brand.owner ? <UserIdentity user={brand.owner} size={24} /> : "—") },
  { key: "official", header: "Official Store", render: (brand) => <OfficialStatusBadge status={brand.officialStatus} />, width: "150px" },
  { key: "requested", header: "Requested", render: (brand) => (brand.officialStatus === "PENDING" ? formatRelativeTimeFromNow(brand.officialRequestSubmittedAt) : "—"), width: "120px" },
  { key: "stores", header: "Stores", render: (brand) => brand.linkedStoreCount, width: "80px", align: "end" },
  { key: "members", header: "Members", render: (brand) => brand.memberCount, width: "90px", align: "end" },
  { key: "claims", header: "Open claims", render: (brand) => brand.openClaimCount, width: "110px", align: "end" },
];

function readOfficialFilterFromQuery(value: string | null): OfficialFilter {
  return officialTabs.some((tab) => tab.key === value) ? (value as OfficialFilter) : "";
}

export function BrandDirectoryWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [official, setOfficial] = useState<OfficialFilter>(readOfficialFilterFromQuery(searchParams.get("official")));
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const list = useAdminQuery((signal) => fetchBrandDirectory({ official, search, cursor }, signal), `${official}|${search}|${cursor ?? ""}`);

  return (
    <>
      <PageHeader area="People · brands" title="Brands" description="Brand profiles, who runs them, the stores that sell under them, and Official Store status. Official Store is a Gold business verification backed by a registered trademark." />
      <SegmentedTabs label="Official Store status" items={officialTabs} activeKey={official} onChange={(key) => { setOfficial(key); setCursor(undefined); }} />
      <Toolbar>
        <TextField label="Search brands" isLabelHidden placeholder="Search by brand name, slug or category" value={search} onChange={(event) => { setSearch(event.target.value); setCursor(undefined); }} />
      </Toolbar>
      {list.errorMessage ? <ErrorBlock error={list.error} message={list.errorMessage} onRetry={list.reload} /> : null}
      <DataTable
        caption="Brands"
        columns={columns}
        rows={list.data?.items ?? []}
        readRowKey={(brand) => brand.id}
        isLoading={list.isLoading}
        onRowOpen={(brand) => router.push(`/brands/${encodeURIComponent(brand.id)}`)}
        emptyMessage="No brands match these filters."
      />
      <CursorPagination cursor={cursor} nextCursor={list.data?.nextCursor} onCursorChange={setCursor} />
    </>
  );
}
