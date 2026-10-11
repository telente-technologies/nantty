"use client";

import { useState } from "react";

import { requestConfirmation } from "@zudomart/web-kit";

import { useBrandWorkspace } from "@/components/brand/brandWorkspace";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { ErrorCallout } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useCursorPagedList } from "@/hooks/useCursorPagedList.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { BrandClaim } from "@/types/brand.type";
import { brandClaimKindLabels, brandClaimStatusLabels } from "@/utils/brandPresentation.util";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";

export function BrandClaimsPanel({ canWithdraw, onChanged }: { readonly canWithdraw: boolean; readonly onChanged: () => void }) {
  const { brand } = useBrandWorkspace();
  const { showToast } = useToast();
  const claims = useCursorPagedList<BrandClaim>(`/seller/brands/${encodeURIComponent(brand.id)}/protection/claims`, {});
  const [withdrawingClaimId, setWithdrawingClaimId] = useState<string | null>(null);

  async function withdrawClaim(claim: BrandClaim) {
    if (!(await requestConfirmation({ title: "Withdraw this claim?", description: "The listings stay up and you can file again later.", confirmLabel: "Withdraw claim", intent: "copyright" }))) return;
    setWithdrawingClaimId(claim.id);
    try {
      await sendSellerApiRequest(`/seller/brands/${encodeURIComponent(brand.id)}/protection/claims/${encodeURIComponent(claim.id)}/withdraw`, { method: "POST", body: {} });
      showToast("Claim withdrawn.");
      claims.reload();
      onChanged();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setWithdrawingClaimId(null);
    }
  }

  return (
    <Panel title="Your claims" padded={false}>
      {claims.errorMessage ? <div style={{ padding: 12 }}><ErrorCallout message={claims.errorMessage} onRetry={claims.reload} /></div> : null}
      <DataTable
        caption="Brand claims"
        rows={claims.items}
        isLoading={claims.isLoading}
        readRowKey={(claim) => claim.id}
        hasMore={claims.hasMore}
        onLoadMore={claims.loadMore}
        isLoadingMore={claims.isLoadingMore}
        emptyState="No claims filed yet."
        columns={[
          { key: "filed", header: "Filed", render: (claim) => formatDateForDisplay(claim.createdAt) },
          { key: "kind", header: "Type", render: (claim) => brandClaimKindLabels[claim.kind] },
          { key: "listings", header: "Listings", render: (claim) => claim.listings.map((listing) => `@${listing.sellerHandle}`).join(", ") },
          { key: "status", header: "Status", render: (claim) => <div><StatusBadge tone={brandClaimStatusLabels[claim.status].tone}>{brandClaimStatusLabels[claim.status].label}</StatusBadge>{claim.resolution ? <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{claim.resolution}</div> : null}</div> },
          {
            key: "actions",
            header: <span className="visuallyHidden">Actions</span>,
            align: "end",
            render: (claim) => (canWithdraw && (claim.status === "submitted" || claim.status === "under_review") ? <Button size="small" variant="ghost" isBusy={withdrawingClaimId === claim.id} onClick={() => void withdrawClaim(claim)}>Withdraw</Button> : null),
          },
        ]}
      />
    </Panel>
  );
}
