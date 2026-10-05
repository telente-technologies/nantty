"use client";

import { useState } from "react";

import { BrandClaimDialog } from "@/components/brand/brandClaimDialog";
import { BrandClaimsPanel } from "@/components/brand/brandClaimsPanel";
import { useBrandWorkspace } from "@/components/brand/brandWorkspace";
import { Button, ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { Callout, EmptyState, ErrorCallout } from "@/components/ui/feedback";
import { FilterBar, SearchInput } from "@/components/ui/filterControls";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { Panel, PageStack } from "@/components/ui/panel";
import { StatusBadge, type StatusTone } from "@/components/ui/statusBadge";
import { useCursorPagedList } from "@/hooks/useCursorPagedList.hook";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { BrandListingReport } from "@/types/brand.type";
import { canBrandRoleManage } from "@/utils/brandPresentation.util";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";
import { formatBasisPointsAsPercent } from "@/utils/money.util";

import styles from "./brand.module.css";

type RiskFilter = "all" | BrandListingReport["risk"];
const riskTones: Record<BrandListingReport["risk"], StatusTone> = { high: "error", medium: "caution", low: "success" };
const relationshipClaimLabels: Record<BrandListingReport["relationshipClaimed"], string> = { own: "Says it's their own brand", authorised_reseller: "Says authorised reseller", genuine_resale: "Says genuine resale" };

function ProtectedListingsPanel() {
  const { brand, myRole, canEditDashboardSettings } = useBrandWorkspace();
  const { formatMoney } = useMoneyFormatter();
  const [searchText, setSearchText] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isClaimOpen, setIsClaimOpen] = useState(false);
  const [claimsVersion, setClaimsVersion] = useState(0);
  const listings = useCursorPagedList<BrandListingReport>(`/seller/brands/${encodeURIComponent(brand.id)}/protection/listings`, { q: searchText, risk: riskFilter === "all" ? null : riskFilter });
  const canFileClaims = canEditDashboardSettings && canBrandRoleManage(myRole);
  const selectedListings = (listings.items ?? []).filter((listing) => selectedIds.includes(listing.id));

  function toggleListingSelection(listingId: string, isSelected: boolean) {
    setSelectedIds((current) => (isSelected ? [...current, listingId].slice(0, 20) : current.filter((candidate) => candidate !== listingId)));
  }

  return (
    <>
      <Panel
        title="Listings that use your brand"
        description="Other sellers tagging your brand. Check the price and the seller before filing a claim."
        padded={false}
        actions={canFileClaims ? <Button variant="danger" size="small" disabled={selectedListings.length === 0} onClick={() => setIsClaimOpen(true)}>File claim ({selectedListings.length})</Button> : null}
      >
        <div style={{ padding: 12 }}>
          <FilterBar>
            <SearchInput label="Search listings or sellers" value={searchText} onValueChange={setSearchText} />
            <SegmentedControl label="Risk" value={riskFilter} onValueChange={setRiskFilter} options={[{ value: "all", label: "All" }, { value: "high", label: "High risk" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
          </FilterBar>
        </div>
        {listings.errorMessage ? <div style={{ padding: 12 }}><ErrorCallout message={listings.errorMessage} onRetry={listings.reload} /></div> : null}
        <DataTable
          caption="Listings by other sellers tagging your brand"
          rows={listings.items}
          isLoading={listings.isLoading}
          readRowKey={(listing) => listing.id}
          hasMore={listings.hasMore}
          onLoadMore={listings.loadMore}
          isLoadingMore={listings.isLoadingMore}
          emptyState={<EmptyState iconName="shield24" title="No listings to review" description="Nobody else is using your brand right now, or none match your filters." />}
          columns={[
            ...(canFileClaims ? [{ key: "select", header: <span className="visuallyHidden">Select</span>, width: "36px", render: (listing: BrandListingReport) => <input type="checkbox" aria-label={`Select ${listing.title}`} checked={selectedIds.includes(listing.id)} disabled={listing.openClaimId !== null} onChange={(event) => toggleListingSelection(listing.id, event.target.checked)} /> }] : []),
            {
              key: "listing",
              header: "Listing",
              render: (listing) => (
                <div className={styles.listingCell}>
                  {listing.imageUrl ? <img src={listing.imageUrl} alt="" className={styles.listingThumb} loading="lazy" /> : <span className={styles.listingThumb} aria-hidden="true" />}
                  <div>
                    <strong>{listing.title}</strong>
                    <div className={styles.riskReasons}>{listing.sellerName} · @{listing.sellerHandle} · {formatDateForDisplay(listing.listedAt)}</div>
                  </div>
                </div>
              ),
            },
            { key: "claim", header: "Seller says", hideBelowTablet: true, render: (listing) => relationshipClaimLabels[listing.relationshipClaimed] },
            { key: "price", header: "Price", align: "end", render: (listing) => formatMoney(listing.price) },
            {
              key: "vs",
              header: "Vs your price",
              align: "end",
              hideBelowTablet: true,
              render: (listing) => (listing.priceDifferenceBasisPoints === null ? "—" : <span style={{ color: listing.priceDifferenceBasisPoints < -2000 ? "var(--error-ink)" : undefined }}>{listing.priceDifferenceBasisPoints > 0 ? "+" : "−"}{formatBasisPointsAsPercent(Math.abs(listing.priceDifferenceBasisPoints))}</span>),
            },
            {
              key: "risk",
              header: "Risk",
              render: (listing) => (
                <div>
                  <StatusBadge tone={riskTones[listing.risk]}>{listing.risk === "high" ? "High" : listing.risk === "medium" ? "Medium" : "Low"}</StatusBadge>
                  {listing.riskReasons.length > 0 ? <div className={styles.riskReasons}>{listing.riskReasons.join(" · ")}</div> : null}
                  {listing.openClaimId ? <div className={styles.riskReasons}>Claim open</div> : null}
                </div>
              ),
            },
          ]}
        />
      </Panel>
      <BrandClaimsPanel key={claimsVersion} canWithdraw={canFileClaims} onChanged={listings.reload} />
      <BrandClaimDialog
        isOpen={isClaimOpen}
        selectedListings={selectedListings}
        onClose={() => setIsClaimOpen(false)}
        onFiled={() => {
          setIsClaimOpen(false);
          setSelectedIds([]);
          listings.reload();
          setClaimsVersion((version) => version + 1);
        }}
      />
    </>
  );
}

export function BrandProtectionView() {
  const { brand } = useBrandWorkspace();
  if (brand.officialStore.status !== "active") {
    return (
      <Panel title="Brand protection">
        <div className={styles.lockedState}>
          <Callout tone="info" title="Available to Official Stores">Brand protection shows every listing by other sellers that uses your brand, flags suspicious prices and new accounts, and lets you file counterfeit or trademark claims.</Callout>
          <p className={styles.muted}>{brand.name} needs a registered brand and an active Official Store first.</p>
          <div><ButtonLink href="/brand/official-store" variant="primary">See how to get an Official Store</ButtonLink></div>
        </div>
      </Panel>
    );
  }
  return (
    <PageStack>
      <ProtectedListingsPanel />
    </PageStack>
  );
}
