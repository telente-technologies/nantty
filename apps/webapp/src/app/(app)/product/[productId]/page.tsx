import { notFound, permanentRedirect } from "next/navigation";

import { fetchPublicProduct } from "@/server/publicContent.service";
import { appendAffiliateParameter } from "@/utils/saleAttribution.util";
import { buildProductPath } from "@/utils/seoPaths.util";

interface LegacyProductPageProps {
  readonly params: Promise<{ readonly productId: string }>;
  readonly searchParams: Promise<{ readonly aff?: string | string[] }>;
}

export default async function LegacyProductPage({ params, searchParams }: LegacyProductPageProps) {
  const { productId } = await params;
  const { aff } = await searchParams;
  const product = await fetchPublicProduct(decodeURIComponent(productId));
  if (!product) notFound();
  permanentRedirect(appendAffiliateParameter(buildProductPath(product), typeof aff === "string" ? aff : undefined));
}
