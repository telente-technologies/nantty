"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ButtonLink } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { DateRangeControl, FilterBar, SearchInput, type DateRangeValue } from "@/components/ui/filterControls";
import { SelectField } from "@/components/ui/formFields";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge, convertSnakeCaseToLabel, type StatusTone } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";
import type { PosSale, SaleStatus } from "@/types/pos.type";
import type { PosRegister } from "@/types/store.type";
import { buildDateRangeEndingToday, formatDateTimeForDisplay } from "@/utils/dateFormatting.util";
import { receiptPaymentMethodLabels } from "@/utils/receiptText.util";

export const saleStatusTones: Record<SaleStatus, StatusTone> = { completed: "success", partially_refunded: "caution", refunded: "neutral", voided: "error" };

export function SalesHistoryView() {
  const router = useRouter();
  const { formatMoney } = useMoneyFormatter();
  const { selectedLocationId, settings } = useStoreContext();
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => buildDateRangeEndingToday(7));
  const [searchText, setSearchText] = useState("");
  const [registerId, setRegisterId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [status, setStatus] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [sales, setSales] = useState<PosSale[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const registersQuery = useSellerQuery<CursorPage<PosRegister>>("/seller/pos/registers", { locationId: selectedLocationId });
  const filters = useMemo(() => ({ from: dateRange.from, to: dateRange.to, q: searchText, registerId, paymentMethod, status, cashierId, locationId: selectedLocationId, limit: 25 }), [dateRange, searchText, registerId, paymentMethod, status, cashierId, selectedLocationId]);

  useEffect(() => {
    const abortController = new AbortController();
    setSales(null);
    setErrorMessage(null);
    sendSellerApiRequest<CursorPage<PosSale>>("/seller/pos/sales", { query: filters, signal: abortController.signal })
      .then((page) => {
        setSales(page.data);
        setNextCursor(page.nextCursor);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException)) setErrorMessage(readErrorMessageForDisplay(error));
      });
    return () => abortController.abort();
  }, [filters]);

  async function loadMoreSales() {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const page = await sendSellerApiRequest<CursorPage<PosSale>>("/seller/pos/sales", { query: { ...filters, cursor: nextCursor } });
      setSales((current) => [...(current ?? []), ...page.data]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsLoadingMore(false);
    }
  }

  const cashierOptions = useMemo(() => {
    const cashiers = new Map((sales ?? []).map((sale) => [sale.cashier.id, sale.cashier.name]));
    return [...cashiers.entries()].map(([id, name]) => ({ value: id, label: name }));
  }, [sales]);

  const columns: DataTableColumn<PosSale>[] = [
    { key: "receipt", header: "Receipt", render: (sale) => <strong>{sale.receiptNumber}</strong> },
    { key: "date", header: "Date", render: (sale) => formatDateTimeForDisplay(sale.createdAt, settings?.locale, settings?.timezone) },
    { key: "customer", header: "Customer", render: (sale) => sale.customer?.name ?? "Walk-in", hideBelowTablet: true },
    { key: "cashier", header: "Cashier", render: (sale) => sale.cashier.name, hideBelowTablet: true },
    { key: "payment", header: "Paid by", render: (sale) => [...new Set(sale.payments.map((payment) => receiptPaymentMethodLabels[payment.method]))].join(" + ") },
    { key: "status", header: "Status", render: (sale) => <StatusBadge tone={saleStatusTones[sale.status]}>{convertSnakeCaseToLabel(sale.status)}</StatusBadge> },
    { key: "total", header: "Total", align: "end", render: (sale) => formatMoney(sale.total) },
  ];

  return (
    <PageStack>
      <PageHeader title="Sales history" description="In-store sales from your registers. Open a sale to reprint, share or refund it." actions={<ButtonLink href="/pos" variant="primary" iconName="shoppingCart24">Open the register</ButtonLink>} />
      <FilterBar>
        <SearchInput label="Search receipts" placeholder="Receipt number, customer name or phone" value={searchText} onValueChange={setSearchText} />
        <DateRangeControl value={dateRange} onValueChange={setDateRange} />
      </FilterBar>
      <FilterBar>
        <SelectField label="Register" hideLabel value={registerId} onChange={(event) => setRegisterId(event.target.value)} options={[{ value: "", label: "All registers" }, ...(registersQuery.data?.data ?? []).map((register) => ({ value: register.id, label: register.name }))]} />
        <SelectField label="Cashier" hideLabel value={cashierId} onChange={(event) => setCashierId(event.target.value)} options={[{ value: "", label: "All cashiers" }, ...cashierOptions]} />
        <SelectField label="Payment method" hideLabel value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} options={[{ value: "", label: "All payment methods" }, ...Object.entries(receiptPaymentMethodLabels).map(([value, label]) => ({ value, label }))]} />
        <SelectField label="Status" hideLabel value={status} onChange={(event) => setStatus(event.target.value)} options={[{ value: "", label: "All statuses" }, ...Object.keys(saleStatusTones).map((value) => ({ value, label: convertSnakeCaseToLabel(value) }))]} />
      </FilterBar>
      {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
      <Panel padded={false}>
        <DataTable
          caption="In-store sales"
          columns={columns}
          rows={sales}
          readRowKey={(sale) => sale.id}
          isLoading={sales === null && !errorMessage}
          onRowActivate={(sale) => router.push(`/sales/${encodeURIComponent(sale.id)}`)}
          hasMore={Boolean(nextCursor)}
          onLoadMore={() => void loadMoreSales()}
          isLoadingMore={isLoadingMore}
          emptyState={<EmptyState iconName="textIndent24" title="No sales match these filters" description="Try a wider date range or clear the filters." />}
        />
      </Panel>
    </PageStack>
  );
}
