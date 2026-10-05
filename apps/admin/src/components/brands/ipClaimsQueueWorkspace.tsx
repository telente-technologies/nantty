"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { Pagination } from "@/components/ui/pagination";
import { Toolbar } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchIpClaims } from "@/services/brandsApi.service";

import { ipClaimColumns, isIpClaimPastSla } from "./ipClaimColumns";

type ClaimStatusFilter = "OPEN" | "NEEDS_INFO" | "UPHELD" | "REJECTED" | "ALL";

const statusTabs: readonly { key: ClaimStatusFilter; label: string }[] = [
  { key: "OPEN", label: "Open" },
  { key: "NEEDS_INFO", label: "Needs info" },
  { key: "UPHELD", label: "Upheld" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

export function IpClaimsQueueWorkspace() {
  const router = useRouter();
  const [status, setStatus] = useState<ClaimStatusFilter>("OPEN");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const list = useAdminQuery((signal) => fetchIpClaims({ status, type, search, page }, signal), `${status}|${type}|${search}|${page}`);

  return (
    <>
      <PageHeader area="Trust & safety" title="Trademark & counterfeit claims" description="Claims filed by brand owners against other sellers' listings. Upholding delists the listing and adds a strike to the seller." />
      <SegmentedTabs label="Claim status" items={statusTabs} activeKey={status} onChange={(key) => { setStatus(key); setPage(1); }} />
      <Toolbar>
        <TextField label="Search claims" isLabelHidden placeholder="Search claim ID, listing, brand or seller" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <SelectField label="Claim type" isLabelHidden value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} options={[{ value: "", label: "All types" }, { value: "COUNTERFEIT", label: "Counterfeit" }, { value: "TRADEMARK", label: "Trademark" }]} />
      </Toolbar>
      {list.errorMessage ? <ErrorBlock message={list.errorMessage} onRetry={list.reload} /> : null}
      <DataTable
        caption="Trademark and counterfeit claims"
        columns={ipClaimColumns}
        rows={list.data?.items ?? []}
        readRowKey={(claim) => claim.id}
        isLoading={list.isLoading}
        onRowOpen={(claim) => router.push(`/ip-claims/${encodeURIComponent(claim.id)}`)}
        readRowTone={(claim) => (isIpClaimPastSla(claim) ? "danger" : claim.priorStrikeCount >= 2 ? "caution" : null)}
        emptyMessage="No claims in this view."
      />
      {list.data ? <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPageChange={setPage} /> : null}
    </>
  );
}
