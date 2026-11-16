"use client";

import { useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card } from "@/components/ui/surfaces";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { lookupFinanceReference } from "@/services/financeApi.service";
import type { FinanceLookupResult } from "@/types/finance.type";
import { formatDateTime, formatMoneyForDisplay, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./finance.module.css";

export function FinanceLookupWorkspace() {
  const { can } = useAdminPermissions();
  const searchParams = useSearchParams();
  const initialRef = searchParams.get("ref") ?? "";
  const [draft, setDraft] = useState(initialRef);
  const [submittedRef, setSubmittedRef] = useState(initialRef);

  const { data, errorMessage, error, isLoading, reload } = useAdminQuery<FinanceLookupResult>(
    (signal) => lookupFinanceReference(submittedRef, signal),
    submittedRef,
    submittedRef.trim().length > 0,
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmittedRef(draft.trim());
  }

  return (
    <>
      <PageHeader
        area="Finance"
        title="Reference lookup"
        description="Search by payment reference, order ID, checkout ID, escrow ID, dispute ID, or withdrawal ID across finance stores."
      />
      <div className={styles.layout}>
        <Card title="Find money trail">
          <form onSubmit={handleSubmit} className={styles.lookupForm}>
            <TextField
              label="Reference or entity ID"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="e.g. escrow-refund:..., pay_..., order UUID, or withdrawal UUID"
            />
            <Button type="submit" variant="primary" iconName="magnifyingGlass16" isBusy={isLoading}>
              Search stores
            </Button>
          </form>
        </Card>
        {errorMessage ? <ErrorBlock error={error} message={errorMessage} onRetry={reload} /> : null}
        {isLoading && !data ? <LoadingBlock lines={4} /> : null}
        {data ? (
          <Card title={data.found ? "Matched records" : "No match found"}>
            <p className={styles.muted}>{data.message}</p>
            <div className={styles.hopList}>
              {data.hops.map((hop) => (
                <div key={`${hop.store}:${hop.entityId}:${hop.reference}`} className={styles.hopCard}>
                  <div className={styles.hopMeta}>
                    <div>
                      <strong>{humanizeConstantName(hop.store)}</strong> · {humanizeConstantName(hop.entityType)} · <StatusBadge status={hop.status} />
                    </div>
                    <div className="mono">{hop.reference || hop.entityId}</div>
                    <div className={styles.muted}>{hop.detail}</div>
                    {hop.occurredAt ? <div className={styles.muted}>{formatDateTime(hop.occurredAt)}</div> : null}
                  </div>
                  <div className={styles.quickLinks}>
                    {hop.amount ? <strong>{formatMoneyForDisplay(hop.amount)}</strong> : null}
                    {hop.actionHref.startsWith("/finance/")
                      || (hop.actionHref.startsWith("/commerce/orders/") && can("orders:read"))
                      || (hop.actionHref.startsWith("/commerce/disputes/") && can("disputes:resolve"))
                      || (hop.actionHref.startsWith("/commerce/payouts/") && can("payouts:approve"))
                      ? <ButtonLink href={hop.actionHref} size="small" variant="secondary">Inspect</ButtonLink>
                      : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
