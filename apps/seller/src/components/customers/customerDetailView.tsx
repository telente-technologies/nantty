"use client";

import Link from "next/link";
import { CustomerStoreCreditPanel } from "@/components/customers/customerStoreCreditPanel";
import { useState } from "react";

import { CustomerFormDialog } from "@/components/customers/customerFormDialog";
import { CustomerNotesPanel } from "@/components/customers/customerNotesPanel";
import { CustomerPurchasesPanel } from "@/components/customers/customerPurchasesPanel";
import { customerTypeLabels, customerTypeTones } from "@/components/customers/customerPresentation.util";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorCallout, LoadingBlock, StatTile } from "@/components/ui/feedback";
import { KeyValueList, PageHeader, PageStack, Panel, ResponsiveGrid } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { Customer } from "@/types/customer.type";
import { deriveCustomerTypeFromPurchases } from "@/utils/customerSegmentRules.util";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";

import styles from "./customers.module.css";
import { IconLabel } from "@/components/ui/zudoIcon";

export function CustomerDetailView({ customerId }: { readonly customerId: string }) {
  const { formatMoney } = useMoneyFormatter();
  const customerQuery = useSellerQuery<Customer>(`/seller/customers/${encodeURIComponent(customerId)}`);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const customer = customerQuery.data;

  if (customerQuery.isLoading && !customer) return <LoadingBlock label="Loading customer" />;
  if (!customer) return <ErrorCallout variant="section" error={customerQuery.error} message={customerQuery.errorMessage ?? "This customer could not be loaded."} onRetry={customerQuery.reload} />;
  const replaceCustomer = (updated: Customer) => customerQuery.replaceData(() => updated);
  const customerType = deriveCustomerTypeFromPurchases(customer);

  return (
    <PageStack>
      <PageHeader
        eyebrow={<Link href="/customers"><IconLabel name="arrowLeft24" size={16}>Customers</IconLabel></Link>}
        title={customer.name}
        description={`${customer.zudomartUsername ? `@${customer.zudomartUsername} on Zudomart` : "No Zudomart username"}${customer.city ? ` · ${customer.city}` : ""}`}
        actions={
          <>
            <StatusBadge tone={customerTypeTones[customerType]}>{customerTypeLabels[customerType]}</StatusBadge>
            {customer.zudomartUsername ? <ButtonLink href={`/messages?customer=${encodeURIComponent(customer.zudomartUsername)}`} iconName="chatCircle24">Message</ButtonLink> : null}
            <Button iconName="slidersHorizontal24" onClick={() => setIsEditDialogOpen(true)}>Edit profile</Button>
          </>
        }
      />
      <ResponsiveGrid minimumColumnWidth={180}>
        <StatTile label="Total spent" value={formatMoney(customer.totalSpent)} />
        <StatTile label="Orders" value={customer.purchasesCount} />
        <StatTile label="Average order value" value={formatMoney(customer.averageOrderValue)} />
        <StatTile label="First order" value={formatDateForDisplay(customer.firstPurchaseAt)} />
        <StatTile label="Last order" value={formatDateForDisplay(customer.lastPurchaseAt)} />
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
          <CustomerStoreCreditPanel customer={customer} />
        </div>
      </div>
      {isEditDialogOpen ? <CustomerFormDialog isOpen customer={customer} onClose={() => setIsEditDialogOpen(false)} onSaved={replaceCustomer} /> : null}
    </PageStack>
  );
}
