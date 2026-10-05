"use client";

import { useRouter } from "next/navigation";

import { useCommerceCursorList } from "@/components/orders/commerceCursorList.hook";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorCallout } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { convertSnakeCaseToLabel, StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { CustomerPurchase } from "@/types/customer.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

export function CustomerPurchasesPanel({ customerId }: { readonly customerId: string }) {
  const router = useRouter();
  const { formatMoney } = useMoneyFormatter();
  const purchases = useCommerceCursorList<CustomerPurchase>(`/seller/customers/${encodeURIComponent(customerId)}/purchases`, { limit: 20 });

  const columns: DataTableColumn<CustomerPurchase>[] = [
    { key: "reference", header: "Reference", render: (purchase) => <strong>{purchase.reference}</strong> },
    { key: "status", header: "Status", render: (purchase) => <StatusBadge tone="info">{convertSnakeCaseToLabel(purchase.status)}</StatusBadge> },
    { key: "date", header: "Date", render: (purchase) => formatDateTimeForDisplay(purchase.createdAt) },
    { key: "items", header: "Items", align: "end", hideBelowTablet: true, render: (purchase) => purchase.itemsCount },
    { key: "total", header: "Total", align: "end", render: (purchase) => formatMoney(purchase.total) },
  ];

  return (
    <Panel title="Order history" description="Orders placed in the Zudomart app" padded={false}>
      {purchases.errorMessage ? <ErrorCallout message={purchases.errorMessage} onRetry={purchases.reload} /> : null}
      <DataTable
        caption="Order history"
        columns={columns}
        rows={purchases.items}
        readRowKey={(purchase) => `${purchase.kind}-${purchase.id}`}
        isLoading={purchases.isLoading}
        onRowActivate={(purchase) => router.push(`/orders/${purchase.id}`)}
        hasMore={purchases.hasMore}
        onLoadMore={purchases.loadMore}
        isLoadingMore={purchases.isLoadingMore}
        errorMessage={null}
        emptyState="No app orders yet."
      />
    </Panel>
  );
}
