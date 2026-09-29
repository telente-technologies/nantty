import type { Metadata } from "next";

import { ProductEditorView } from "@/components/catalog/productEditorView";

export const metadata: Metadata = { title: "New product" };

export default function NewProductPage() {
  return <ProductEditorView productId={null} />;
}
