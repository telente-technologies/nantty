import type { Metadata } from "next";

import { ProductListView } from "@/components/catalog/productListView";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { readonly searchParams: Promise<{ categoryId?: string; status?: string; stock?: string; supplierId?: string }> }) {
  const { categoryId, status, stock, supplierId } = await searchParams;
  const readShortText = (value: string | undefined) => (typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : "");
  return <ProductListView initialCategoryId={readShortText(categoryId)} initialStatus={readShortText(status)} initialStock={readShortText(stock)} initialSupplierId={readShortText(supplierId)} />;
}
