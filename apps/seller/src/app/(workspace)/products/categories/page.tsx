import type { Metadata } from "next";

import { ProductCategoriesView } from "@/components/catalog/productCategoriesView";

export const metadata: Metadata = { title: "Product categories" };

export default function ProductCategoriesPage() {
  return <ProductCategoriesView />;
}
