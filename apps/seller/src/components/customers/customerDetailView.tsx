"use client";

import Link from "next/link";
import { useState } from "react";

import { CustomerFormDialog } from "@/components/customers/customerFormDialog";
import { CustomerLoyaltyPanel } from "@/components/customers/customerLoyaltyPanel";
import { CustomerNotesPanel } from "@/components/customers/customerNotesPanel";
import { CustomerPurchasesPanel } from "@/components/customers/customerPurchasesPanel";
import { Button } from "@/components/ui/button";
import { Callout, LoadingBlock, StatTile } from "@/components/ui/feedback";
import { KeyValueList, PageHeader, PageStack, Panel, ResponsiveGrid } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { Customer } from "@/types/customer.type";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";

import styles from "./customers.module.css";

export function CustomerDetailView({ customerId }: { readonly customerId: string }) {
  const { formatMoney } = useMoneyFormatter();
  const customerQuery = useSellerQuery<Customer>(`/seller/customers/${encodeURIComponent(customerId)}`);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const customer = customerQuery.data;

  if (customerQuery.isLoading && !customer) return <LoadingBlock label="Loading customer" />;
  if (!customer) return <Callout tone="error">{customerQuery.errorMessage ?? "This customer could not be loaded."}</Callout>;
  const replaceCustomer = (updated: Customer) => customerQuery.replaceData(() => updated);
  const averageSpend = customer.purchasesCount > 0 ? { amountMinor: Math.round(customer.totalSpent.amountMinor / customer.purchasesCount), currency: customer.totalSpent.currency } : null;

  return (
    <PageStack>
      <PageHeader
        eyebrow={<Link href="/customers">← Customers</Link>}
        title={customer.name}
        description={customer.zudomartUsername ? `@${customer.zudomartUsername} on Zudomart` : "Walk-in customer"}
        actions={<Button iconName="slidersHorizontal24" onClick={() => setIsEditDialogOpen(true)}>Edit profile</Button>}
      />
      <ResponsiveGrid minimumColumnWidth={180}>
        <StatTile label="Total spent" value={formatMoney(customer.totalSpent)} />
        <StatTile label="Purchases" value={customer.purchasesCount} />
        <StatTile label="Average spend" value={formatMoney(averageSpend)} />
        <StatTile label="Last purchase" value={formatDateForDisplay(customer.lastPurchaseAt)} />
      </ResponsiveGrid>
      <div className={styles.detailGrid}>
        <div className={styles.stack}>
          <CustomerPurchasesPanel customerId={customer.id} />
          <CustomerNotesPanel customer={customer} onCustomerChanged={replaceCustomer} />
        </div>
        <div className={styles.stack}>
          <Panel title="Contact">
            <KeyValueList
              items={[
                { label: "Phone", value: customer.phone ?? "—" },
                { label: "Email", value: customer.email ?? "—" },
                { label: "Offers and news", value: customer.marketingOptIn ? "Opted in" : "Not opted in" },
                { label: "Customer since", value: formatDateForDisplay(customer.createdAt) },
              ]}
            />
            {customer.tags.length > 0 ? (
              <div className={styles.tagList} style={{ marginTop: 12 }}>
                {customer.tags.map((tag) => <StatusBadge key={tag} tone="info">{tag}</StatusBadge>)}
              </div>
            ) : null}
          </Panel>
          <CustomerLoyaltyPanel customer={customer} onCustomerChanged={replaceCustomer} />
        </div>
      </div>
      {isEditDialogOpen ? <CustomerFormDialog isOpen customer={customer} onClose={() => setIsEditDialogOpen(false)} onSaved={replaceCustomer} /> : null}
    </PageStack>
  );
}
