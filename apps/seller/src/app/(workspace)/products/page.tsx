import type { Metadata } from "next";

import { ProductListView } from "@/components/catalog/productListView";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return <ProductListView />;
}
