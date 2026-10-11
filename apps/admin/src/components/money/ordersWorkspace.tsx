"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { CursorPagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchOrders } from "@/services/moneyApi.service";
import type { OrderSummary } from "@/types/commerce.type";
import { formatDateTime, formatMoneyForDisplay, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./money.module.css";

const statusOptions = ["", "pending", "new", "processing", "ready", "shipped", "delivered", "completed", "disputed", "returned", "refunded", "cancelled"].map((value) => ({ value, label: value === "" ? "All statuses" : humanizeConstantName(value) }));
const currencyOptions = ["", "NGN", "GHS", "KES", "ZAR", "GBP", "EUR", "USD"].map((value) => ({ value, label: value === "" ? "All currencies" : value }));

const orderColumns: readonly DataTableColumn<OrderSummary>[] = [
  { key: "number", header: "Order", render: (order) => order.orderNumber, isMono: true, width: "120px" },
  { key: "buyer", header: "Buyer", render: (order) => <UserIdentity user={order.buyer} size={24} /> },
  { key: "seller", header: "Store", render: (order) => <span className={styles.stack}><strong>{order.storeName}</strong><span className={styles.muted}>@{order.seller.username}</span></span> },
  { key: "total", header: "Total", render: (order) => <span className={styles.amount}>{formatMoneyForDisplay(order.total)}</span>, align: "end" },
  { key: "status", header: "Order", render: (order) => <StatusBadge status={order.status} /> },
  { key: "escrow", header: "Escrow", render: (order) => <StatusBadge status={order.escrowStatus} hasDot={false} /> },
  { key: "payment", header: "Payment", render: (order) => <span className={styles.muted}>{humanizeConstantName(order.paymentStatus)}</span> },
  { key: "placed", header: "Placed", render: (order) => <span className={styles.muted}>{formatDateTime(order.placedAt)}</span> },
];

export function OrdersWorkspace() {
  const router = useRouter();
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [currency, setCurrency] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const filters = { search: appliedSearch || undefined, status: status || undefined, currency: currency || undefined, cursor };
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchOrders(filters, signal), JSON.stringify(filters));

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setAppliedSearch(searchText.trim());
    setCursor(undefined);
  }

  return (
    <>
      <PageHeader area="Money" title="Orders" description="Look up any order by number, buyer, seller or store and follow its escrow from payment to release." />
      <form onSubmit={applySearch}>
        <Toolbar>
          <TextField label="Search orders" isLabelHidden placeholder="Order or invoice number, buyer name or username" value={searchText} onChange={(event) => setSearchText(event.target.value)} className={styles.searchField} />
          <Button type="submit" iconName="magnifyingGlass16">Search</Button>
          <SelectField label="Status" isLabelHidden options={statusOptions} value={status} onChange={(event) => { setStatus(event.target.value); setCursor(undefined); }} className={styles.filterField} />
          <SelectField label="Currency" isLabelHidden options={currencyOptions} value={currency} onChange={(event) => { setCurrency(event.target.value); setCursor(undefined); }} className={styles.filterField} />
        </Toolbar>
      </form>
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Orders" columns={orderColumns} rows={data?.items ?? []} readRowKey={(order) => order.id} isLoading={isLoading} onRowOpen={(order) => router.push(`/commerce/orders/${order.id}`)} readRowTone={(order) => (order.status === "disputed" ? "danger" : null)} emptyMessage="No orders match these filters." />
      <CursorPagination cursor={cursor} nextCursor={data?.nextCursor} onCursorChange={setCursor} />
    </>
  );
}
