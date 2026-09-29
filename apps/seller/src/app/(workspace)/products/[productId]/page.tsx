import type { Metadata } from "next";

import { ProductEditorView } from "@/components/catalog/productEditorView";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { readonly params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  return <ProductEditorView productId={productId} />;
}
