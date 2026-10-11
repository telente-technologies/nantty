"use client";

import { useState } from "react";

import { AffiliateCreatorIdentity } from "@/components/affiliates/affiliateCreatorIdentity";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { EmptyState, ErrorCallout } from "@/components/ui/feedback";
import { DateRangeControl, FilterBar, type DateRangeValue } from "@/components/ui/filterControls";
import { ModalDialog } from "@/components/ui/modalDialog";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { AffiliateCreatorPerformance } from "@/types/affiliate.type";
import type { CursorPage } from "@/types/pagination.type";
import { convertRowsToCsvText, triggerBrowserDownload } from "@/utils/csvFile.util";
import { buildDateRangeEndingToday, formatDateForDisplay } from "@/utils/dateFormatting.util";
import { convertMinorUnitsToMajorInputText } from "@/utils/money.util";

export function AffiliateCreatorsView() {
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => buildDateRangeEndingToday(90));
  const creatorsQuery = useSellerQuery<CursorPage<AffiliateCreatorPerformance>>("/seller/affiliates/creators", { from: dateRange.from, to: dateRange.to });
  const { formatMoney } = useMoneyFormatter();
  const { showToast } = useToast();
  const [busyCreatorId, setBusyCreatorId] = useState<string | null>(null);
  const [creatorBeingRemoved, setCreatorBeingRemoved] = useState<AffiliateCreatorPerformance | null>(null);
  const rows = creatorsQuery.data?.data ?? null;

  async function changeCreatorProgramStatus(row: AffiliateCreatorPerformance, action: "pause" | "resume" | "remove") {
    setBusyCreatorId(row.creator.id);
    try {
      const creatorPath = `/seller/affiliates/creators/${encodeURIComponent(row.creator.id)}`;
      if (action === "remove") await sendSellerApiRequest(creatorPath, { method: "DELETE" });
      else await sendSellerApiRequest(creatorPath, { method: "PATCH", body: { status: action === "pause" ? "paused" : "active" } });
      showToast(action === "remove" ? `Removed @${row.creator.username}.` : action === "pause" ? `Paused @${row.creator.username}. Their links stop earning.` : `@${row.creator.username} is active again.`);
      setCreatorBeingRemoved(null);
      creatorsQuery.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusyCreatorId(null);
    }
  }

  function downloadCreatorPerformanceCsv() {
    if (!rows) return;
    const csvText = convertRowsToCsvText(
      ["Username", "Name", "Status", "Clicks", "Orders", "Currency", "Sales", "Commission owed", "Commission paid", "Last sale"],
      rows.map((row) => [row.creator.username, row.creator.name, row.status, row.clicks, row.orders, row.sales.currency, convertMinorUnitsToMajorInputText(row.sales.amountMinor, row.sales.currency), convertMinorUnitsToMajorInputText(row.commissionOwed.amountMinor, row.commissionOwed.currency), convertMinorUnitsToMajorInputText(row.commissionPaid.amountMinor, row.commissionPaid.currency), row.lastSaleAt ?? ""]),
    );
    triggerBrowserDownload(`creator-performance-${dateRange.from}-to-${dateRange.to}.csv`, csvText);
  }

  return (
    <>
      <FilterBar>
        <DateRangeControl value={dateRange} onValueChange={setDateRange} />
        <Button iconName="export24" size="small" onClick={downloadCreatorPerformanceCsv} disabled={!rows || rows.length === 0}>
          Export CSV
        </Button>
      </FilterBar>
      {creatorsQuery.errorMessage ? <ErrorCallout message={creatorsQuery.errorMessage} onRetry={creatorsQuery.reload} /> : null}
      <Panel padded={false}>
        <DataTable
          caption="Creators in your affiliate program"
          rows={rows}
          isLoading={creatorsQuery.isLoading}
          readRowKey={(row) => row.creator.id}
          emptyState={<EmptyState iconName="videoCamera24" title="No creators in your program" description="Approve requests or invite creators to a live to get started." />}
          columns={[
            { key: "creator", header: "Creator", render: (row) => <AffiliateCreatorIdentity creator={row.creator} /> },
            { key: "status", header: "Status", render: (row) => <StatusBadge tone={row.status === "active" ? "success" : "caution"}>{row.status === "active" ? "Active" : "Paused"}</StatusBadge> },
            { key: "clicks", header: "Clicks", align: "end", hideBelowTablet: true, render: (row) => row.clicks.toLocaleString("en-NG") },
            { key: "orders", header: "Orders", align: "end", render: (row) => row.orders },
            { key: "sales", header: "Sales", align: "end", render: (row) => formatMoney(row.sales) },
            { key: "owed", header: "Owed", align: "end", render: (row) => formatMoney(row.commissionOwed) },
            { key: "paid", header: "Paid", align: "end", hideBelowTablet: true, render: (row) => formatMoney(row.commissionPaid) },
            { key: "last", header: "Last sale", hideBelowTablet: true, render: (row) => formatDateForDisplay(row.lastSaleAt) },
            {
              key: "actions",
              header: <span className="visuallyHidden">Actions</span>,
              align: "end",
              render: (row) => (
                <span style={{ display: "inline-flex", gap: 6 }}>
                  <Button size="small" isBusy={busyCreatorId === row.creator.id} onClick={() => void changeCreatorProgramStatus(row, row.status === "active" ? "pause" : "resume")}>
                    {row.status === "active" ? "Pause" : "Resume"}
                  </Button>
                  <Button size="small" variant="ghost" onClick={() => setCreatorBeingRemoved(row)}>
                    Remove
                  </Button>
                </span>
              ),
            },
          ]}
        />
      </Panel>
      <ModalDialog intent="removeMember"
        isOpen={creatorBeingRemoved !== null}
        title={`Remove @${creatorBeingRemoved?.creator.username ?? ""} from your program?`}
        description="Their links stop earning straight away. Commission already owed is still paid when escrow is released."
        onClose={() => setCreatorBeingRemoved(null)}
        width="small"
        footer={
          <>
            <Button onClick={() => setCreatorBeingRemoved(null)}>Keep creator</Button>
            <Button variant="danger" isBusy={busyCreatorId !== null} onClick={() => creatorBeingRemoved && void changeCreatorProgramStatus(creatorBeingRemoved, "remove")}>
              Remove creator
            </Button>
          </>
        }
      >
        <p>They can request to join again later.</p>
      </ModalDialog>
    </>
  );
}
