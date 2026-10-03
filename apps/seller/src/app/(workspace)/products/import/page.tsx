import type { Metadata } from "next";

import { ProductImportView } from "@/components/catalog/productImportView";

export const metadata: Metadata = { title: "Import and export products" };

export default function ImportProductsPage() {
  return <ProductImportView />;
}
