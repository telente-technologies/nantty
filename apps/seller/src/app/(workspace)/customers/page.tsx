import type { Metadata } from "next";

import { CustomersListView } from "@/components/customers/customersListView";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { readonly searchParams: Promise<{ segment?: string }> }) {
  const { segment } = await searchParams;
  return <CustomersListView initialSegmentId={typeof segment === "string" ? segment.slice(0, 64) : ""} />;
}
