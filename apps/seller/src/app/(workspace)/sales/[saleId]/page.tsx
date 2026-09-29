import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SaleDetailView } from "@/components/pos/saleDetailView";

export const metadata: Metadata = { title: "Sale" };

export default async function SaleDetailPage({ params }: { readonly params: Promise<{ readonly saleId: string }> }) {
  const { saleId } = await params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(saleId)) notFound();
  return <SaleDetailView saleId={saleId} />;
}
