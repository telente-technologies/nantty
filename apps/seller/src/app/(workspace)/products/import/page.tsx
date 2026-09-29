import type { Metadata } from "next";

import { ProductImportView } from "@/components/catalog/productImportView";

export const metadata: Metadata = { title: "Import products" };

export default function ImportProductsPage() {
  return <ProductImportView />;
}
