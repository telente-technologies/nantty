import { notFound, permanentRedirect } from "next/navigation";

import { fetchPublicProduct } from "@/server/publicContent.service";
import { buildProductPath } from "@/utils/seoPaths.util";

export default async function LegacyProductPage({ params }: { readonly params: Promise<{ readonly productId: string }> }) {
  const { productId } = await params;
  const product = await fetchPublicProduct(decodeURIComponent(productId));
  if (!product) notFound();
  permanentRedirect(buildProductPath(product));
}
