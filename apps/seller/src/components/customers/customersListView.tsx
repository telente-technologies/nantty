"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CustomerFormDialog } from "@/components/customers/customerFormDialog";
import { useCommerceCursorList } from "@/components/orders/commerceCursorList.hook";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { FilterBar, SearchInput } from "@/components/ui/filterControls";
import { SelectField, TextField } from "@/components/ui/formFields";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { Customer } from "@/types/customer.type";
import { triggerBrowserDownload } from "@/utils/csvFile.util";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";

import styles from "./customers.module.css";

type CustomerSort = "recent" | "spend" | "name";

export function CustomersListView() {
  const router = useRouter();
  const { showToast } = useToast();
  const { formatMoney } = useMoneyFormatter();
  const [searchText, setSearchText] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sort, setSort] = useState<CustomerSort>("recent");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const normalisedTag = tagFilter.trim().toLowerCase();
  const query = { q: searchText, tag: normalisedTag, sort };
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
    { key: "name", header: "Customer", render: (customer) => <span className={styles.primaryCell}><strong>{customer.name}</strong><span className={styles.muted}>{customer.zudomartUsername ? `@${customer.zudomartUsername}` : customer.email ?? ""}</span></span> },
    { key: "phone", header: "Phone", hideBelowTablet: true, render: (customer) => customer.phone ?? "—" },
    { key: "tags", header: "Tags", hideBelowTablet: true, render: (customer) => <span className={styles.tagList}>{customer.tags.map((tag) => <StatusBadge key={tag} tone="info">{tag}</StatusBadge>)}</span> },
    { key: "purchases", header: "Purchases", align: "end", render: (customer) => customer.purchasesCount },
    { key: "spent", header: "Total spent", align: "end", render: (customer) => formatMoney(customer.totalSpent) },
    { key: "points", header: "Points", align: "end", hideBelowTablet: true, render: (customer) => customer.loyaltyPoints.toLocaleString() },
    { key: "last", header: "Last purchase", render: (customer) => formatDateForDisplay(customer.lastPurchaseAt) },
  ];

  return (
    <PageStack>
      <PageHeader
        title="Customers"
        description="Everyone who has bought from you in store or online, with their history, notes and loyalty points."
        actions={
          <>
            <Button iconName="export24" onClick={() => void downloadCustomersAsCsv()} isBusy={isExporting}>Export CSV</Button>
            <Button variant="primary" iconName="plus16" onClick={() => setIsCreateDialogOpen(true)}>Add customer</Button>
          </>
        }
      />
      <FilterBar>
        <SearchInput label="Search customers" placeholder="Name, phone, email or username" value={searchText} onValueChange={setSearchText} />
        <TextField label="Tag" hideLabel placeholder="Filter by tag" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} maxLength={24} />
        <SelectField label="Sort" hideLabel value={sort} onChange={(event) => setSort(event.target.value as CustomerSort)} options={[{ value: "recent", label: "Most recent" }, { value: "spend", label: "Highest spend" }, { value: "name", label: "Name A–Z" }]} />
      </FilterBar>
      {customersList.errorMessage ? <Callout tone="error">{customersList.errorMessage}</Callout> : null}
      <Panel padded={false}>
        <DataTable
          caption="Customers"
          columns={columns}
          rows={customersList.items}
          readRowKey={(customer) => customer.id}
          isLoading={customersList.isLoading}
          onRowActivate={(customer) => router.push(`/customers/${customer.id}`)}
          hasMore={customersList.hasMore}
          onLoadMore={customersList.loadMore}
          isLoadingMore={customersList.isLoadingMore}
          emptyState={<EmptyState iconName="userCircle24" title="No customers found" description="Add a customer here or at the till when you make a sale." />}
        />
      </Panel>
      {isCreateDialogOpen ? <CustomerFormDialog isOpen customer={null} onClose={() => setIsCreateDialogOpen(false)} onSaved={(customer) => router.push(`/customers/${customer.id}`)} /> : null}
    </PageStack>
  );
}
