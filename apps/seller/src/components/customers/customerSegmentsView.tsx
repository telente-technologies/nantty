"use client";

import Link from "next/link";
import { useState } from "react";

import { requestConfirmation } from "@nantty/web-kit";

import { PlanGate } from "@/components/billing/planGate";
import { CustomerSegmentEditorDialog } from "@/components/customers/customerSegmentEditorDialog";
import { describeSegmentRuleInWords } from "@/components/customers/customerSegmentRuleEditor";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { PageHeader, PageStack } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { CustomerSegment } from "@/types/customer.type";
import type { CursorPage } from "@/types/pagination.type";

import styles from "./customerSegments.module.css";
import { IconLabel } from "@/components/ui/zudoIcon";

function CustomerSegmentCard({ segment, canEdit, onEdit, onDelete }: { readonly segment: CustomerSegment; readonly canEdit: boolean; readonly onEdit: () => void; readonly onDelete: () => void }) {
  const { formatMoney, formatMoneyCompact, currency } = useMoneyFormatter();
  const formatMinorAmount = (amountMinor: number) => (currency ? formatMoney({ amountMinor, currency }) : String(amountMinor));
  return (
    <article className={styles.segmentCard}>
      <header className={styles.segmentHeader}>
        <div>
          <p className={styles.segmentName}>{segment.name}</p>
          <p className={styles.segmentDescription}>{segment.description || "No description"}</p>
        </div>
        <StatusBadge tone={segment.kind === "built_in" ? "neutral" : "info"}>{segment.kind === "built_in" ? "Built in" : "Custom"}</StatusBadge>
      </header>
      <div className={styles.segmentStats}>
        <span><span className={styles.segmentStatLabel}>Customers</span><span className={styles.segmentStatValue}>{segment.customerCount}</span></span>
        <span><span className={styles.segmentStatLabel}>Total spent</span><span className={styles.segmentStatValue}>{formatMoneyCompact(segment.totalSpent)}</span></span>
        <span><span className={styles.segmentStatLabel}>Avg. order</span><span className={styles.segmentStatValue}>{formatMoneyCompact(segment.averageOrderValue)}</span></span>
      </div>
      <div className={styles.ruleList} aria-label="Rules">
        {segment.rules.map((rule, index) => <StatusBadge key={index}>{describeSegmentRuleInWords(rule, formatMinorAmount)}</StatusBadge>)}
      </div>
      <div className={styles.segmentActions}>
        <ButtonLink href={`/customers?segment=${encodeURIComponent(segment.id)}`} size="small">View customers</ButtonLink>
        {segment.kind === "custom" && canEdit ? (
          <>
            <Button size="small" variant="ghost" onClick={onEdit}>Edit</Button>
            <Button size="small" variant="ghost" onClick={onDelete}>Delete</Button>
          </>
        ) : null}
      </div>
    </article>
  );
}

function CustomerSegmentsList() {
  const { can } = useSellerSession();
  const { showToast } = useToast();
  const segmentsQuery = useSellerQuery<CursorPage<CustomerSegment>>("/seller/customers/segments");
  const [editingSegment, setEditingSegment] = useState<CustomerSegment | "new" | null>(null);
  const canEdit = can("customers:manage");

  async function deleteSegment(segment: CustomerSegment) {
    if (!(await requestConfirmation({ title: `Delete “${segment.name}”?`, description: "Customers in it are not affected.", confirmLabel: "Delete segment", tone: "danger", intent: "delete" }))) return;
    try {
      await sendSellerApiRequest(`/seller/customers/segments/${encodeURIComponent(segment.id)}`, { method: "DELETE" });
      showToast(`Deleted ${segment.name}.`);
      segmentsQuery.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    }
  }

  const segments = segmentsQuery.data?.data ?? [];
  return (
    <>
      {canEdit ? <div><Button variant="primary" iconName="plus16" onClick={() => setEditingSegment("new")}>New segment</Button></div> : null}
      {segmentsQuery.isLoading && !segmentsQuery.data ? <LoadingBlock label="Loading segments" /> : null}
      {segmentsQuery.errorMessage ? <Callout tone="error" action={<Button size="small" onClick={segmentsQuery.reload}>Try again</Button>}>{segmentsQuery.errorMessage}</Callout> : null}
      {segmentsQuery.data && segments.length === 0 ? <EmptyState iconName="userCircle24" title="No segments yet" description="Create one to group customers by spend, orders or city." /> : null}
      <div className={styles.segmentGrid}>
        {segments.map((segment) => <CustomerSegmentCard key={segment.id} segment={segment} canEdit={canEdit} onEdit={() => setEditingSegment(segment)} onDelete={() => void deleteSegment(segment)} />)}
      </div>
      {editingSegment ? (
        <CustomerSegmentEditorDialog
          segment={editingSegment === "new" ? null : editingSegment}
          onClose={() => setEditingSegment(null)}
          onSaved={() => {
            setEditingSegment(null);
            segmentsQuery.reload();
          }}
        />
      ) : null}
    </>
  );
}

export function CustomerSegmentsView() {
  const { hasFeature } = usePlanFeatures();
  return (
    <PageStack>
      <PageHeader eyebrow={<Link href="/customers"><IconLabel name="arrowLeft24" size={16}>Customers</IconLabel></Link>} title="Customer segments" description="Group your Nantty buyers by how much and how often they order, then target them with discount codes and flash sales." />
      <PlanGate feature="customer_segments" description="Segments group customers into New, Returning, VIP and At risk automatically, and let you build your own rules. Available on Pro and Business.">
        {hasFeature("customer_segments") ? <CustomerSegmentsList /> : null}
      </PlanGate>
    </PageStack>
  );
}
