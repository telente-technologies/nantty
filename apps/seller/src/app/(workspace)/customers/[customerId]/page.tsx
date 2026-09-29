import type { Metadata } from "next";

import { CustomerDetailView } from "@/components/customers/customerDetailView";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerDetailPage({ params }: { readonly params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  return <CustomerDetailView customerId={customerId} />;
}
