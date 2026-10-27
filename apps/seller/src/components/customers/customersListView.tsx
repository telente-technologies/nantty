"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FeaturePlanBadge } from "@/components/billing/planGate";
import { CustomerFormDialog } from "@/components/customers/customerFormDialog";
import { customerTypeLabels, customerTypeTones } from "@/components/customers/customerPresentation.util";
import { CustomersSummaryPanels } from "@/components/customers/customersSummaryPanels";
import { useCommerceCursorList } from "@/components/orders/commerceCursorList.hook";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { DataTable, type DataTableColumn, type TableSortState } from "@/components/ui/dataTable";
import { EmptyState } from "@/components/ui/feedback";
import { FilterBar, SearchInput } from "@/components/ui/filterControls";
import { SelectField, TextField } from "@/components/ui/formFields";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { Customer, CustomerSegment, CustomerType } from "@/types/customer.type";
import type { CursorPage } from "@/types/pagination.type";
import { deriveCustomerTypeFromPurchases } from "@/utils/customerSegmentRules.util";
import { triggerBrowserDownload } from "@/utils/csvFile.util";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";

import styles from "./customers.module.css";

export function CustomersListView({ initialSegmentId = "" }: { readonly initialSegmentId?: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { can } = useSellerSession();
  const { hasFeature } = usePlanFeatures();
  const { formatMoney } = useMoneyFormatter();
  const canUseSegments = hasFeature("customer_segments");
  const [searchText, setSearchText] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<CustomerType | "all">("all");
  const [segmentId, setSegmentId] = useState(initialSegmentId);
  const [sortState, setSortState] = useState<TableSortState>({ key: "recent", direction: "descending" });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const segmentsQuery = useSellerQuery<CursorPage<CustomerSegment>>(canUseSegments ? "/seller/customers/segments" : null);
  const query = { q: searchText, tag: tagFilter.trim().toLowerCase(), type: typeFilter, segmentId: canUseSegments ? segmentId : "", sort: sortState.key, direction: sortState.direction === "ascending" ? "asc" : "desc" };
  const customersList = useCommerceCursorList<Customer>("/seller/customers", { ...query, limit: 25 });

  async function downloadCustomersAsCsv() {
    setIsExporting(true);
    try {
      const csvText = await sendSellerApiRequest<string>("/seller/customers/export", { query, expect: "text" });
      triggerBrowserDownload(`customers-${new Date().toISOString().slice(0, 10)}.csv`, csvText);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsExporting(false);
    }
  }

  const columns: DataTableColumn<Customer>[] = [
    { key: "name", header: "Customer", sortKey: "name", render: (customer) => <span className={styles.primaryCell}><strong>{customer.name}</strong><span className={styles.muted}>{customer.nanttyUsername ? `@${customer.nanttyUsername}` : "No Nantty username"}{customer.city ? ` · ${customer.city}` : ""}</span></span> },
    { key: "type", header: "Type", render: (customer) => { const type = deriveCustomerTypeFromPurchases(customer); return <StatusBadge tone={customerTypeTones[type]}>{customerTypeLabels[type]}</StatusBadge>; } },
    { key: "tags", header: "Tags", hideBelowTablet: true, render: (customer) => <span className={styles.tagList}>{customer.tags.map((tag) => <StatusBadge key={tag} tone="info">{tag}</StatusBadge>)}</span> },
    { key: "purchases", header: "Orders", align: "end", sortKey: "purchases", render: (customer) => customer.purchasesCount },
    { key: "spent", header: "Total spent", align: "end", sortKey: "spend", render: (customer) => formatMoney(customer.totalSpent) },
    { key: "aov", header: "Avg. order", align: "end", sortKey: "aov", hideBelowTablet: true, render: (customer) => formatMoney(customer.averageOrderValue) },
    { key: "last", header: "Last order", sortKey: "recent", hideBelowTablet: true, render: (customer) => formatDateForDisplay(customer.lastPurchaseAt) },
  ];

  const segmentOptions = [{ value: "", label: canUseSegments ? "All segments" : "Segments (Pro)" }, ...(segmentsQuery.data?.data ?? []).map((segment) => ({ value: segment.id, label: `${segment.name} (${segment.customerCount})` }))];

  return (
    <PageStack>
      <PageHeader
        title="Customers"
        description="Everyone who has bought from you in the Nantty app, with their order history, spend, notes and segments."
        actions={
          <>
            <ButtonLink href="/customers/segments" iconName="userCircle24">Segments <FeaturePlanBadge feature="customer_segments" /></ButtonLink>
            <Button iconName="export24" onClick={() => void downloadCustomersAsCsv()} isBusy={isExporting}>Export CSV</Button>
            {can("customers:manage") ? <Button variant="primary" iconName="plus16" onClick={() => setIsCreateDialogOpen(true)}>Add customer</Button> : null}
          </>
        }
      />
      <CustomersSummaryPanels />
      <SegmentedControl label="Customer type" value={typeFilter} onValueChange={setTypeFilter} options={[{ value: "all", label: "All" }, { value: "new", label: "New" }, { value: "returning", label: "Returning" }, { value: "no_orders", label: "No orders yet" }]} />
      <FilterBar>
        <SearchInput label="Search customers" placeholder="Name, @username, phone or city" value={searchText} onValueChange={setSearchText} />
        <TextField label="Tag" hideLabel placeholder="Filter by tag" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} maxLength={24} />
        <SelectField label="Segment" hideLabel value={segmentId} disabled={!canUseSegments} onChange={(event) => setSegmentId(event.target.value)} options={segmentOptions} />
      </FilterBar>
      <Panel padded={false}>
        <DataTable
          caption="Customers"
          columns={columns}
          rows={customersList.isLoading && customersList.items.length === 0 ? null : customersList.items}
          readRowKey={(customer) => customer.id}
          isLoading={customersList.isLoading}
          errorMessage={customersList.errorMessage}
          onRetry={customersList.reload}
          sortState={sortState}
          onSortChange={setSortState}
          onRowActivate={(customer) => router.push(`/customers/${customer.id}`)}
          hasMore={customersList.hasMore}
          onLoadMore={customersList.loadMore}
          isLoadingMore={customersList.isLoadingMore}
          emptyState={<EmptyState iconName="userCircle24" title="No customers found" description="Customers appear here when they order from you in the Nantty app. Try a different filter." />}
        />
      </Panel>
      {isCreateDialogOpen ? <CustomerFormDialog isOpen customer={null} onClose={() => setIsCreateDialogOpen(false)} onSaved={(customer) => router.push(`/customers/${customer.id}`)} /> : null}
    </PageStack>
  );
}
