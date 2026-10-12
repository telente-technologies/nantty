import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { fetchPublicProduct } from "@/server/publicContent.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { buildAbsoluteSiteUrl, buildProductPath, buildStorePath, readProductIdFromSlug } from "@/utils/seoPaths.util";
import { buildBreadcrumbJsonLd, buildOrganizationJsonLd, buildProductJsonLd, convertMinorAmountToDecimalString, isProductInStock, serializeJsonLdForScriptTag } from "@/utils/structuredData.util";

import { appendAffiliateParameter } from "@/utils/saleAttribution.util";

import { ProductDetailView } from "../../product/[productId]/productDetailView";

interface ProductPageProps {
  readonly params: Promise<{ readonly slugAndId: string }>;
  readonly searchParams: Promise<{ readonly aff?: string | string[] }>;
}

async function loadProductForSlug(slugAndId: string) {
  const productId = readProductIdFromSlug(slugAndId);
  return productId ? fetchPublicProduct(productId) : null;
}

function summariseDescription(text: string): string {
  const flattened = text.replace(/\s+/g, " ").trim();
  return flattened.length > 155 ? `${flattened.slice(0, 154).trimEnd()}…` : flattened;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = await loadProductForSlug((await params).slugAndId);
  if (!product) return { title: "Product not found", robots: { index: false } };
  const canonicalUrl = buildAbsoluteSiteUrl(buildProductPath(product));
  const price = formatMoneyForDisplay(product.price);
  const description = summariseDescription(`${price} · ${product.description || `${product.title} from ${product.store.name}`}`);
  const images = (product.images.length > 0 ? product.images : [product.imageUrl]).filter((image): image is string => !!image).slice(0, 4);
  return {
    title: `${product.name || product.title} · ${price}`,
    description,
    alternates: { canonical: canonicalUrl, languages: { "en-NG": canonicalUrl, "x-default": canonicalUrl } },
    openGraph: { type: "website", url: canonicalUrl, siteName: "Zudomart", title: product.name || product.title, description, images: images.map((url) => ({ url, alt: product.title })) },
    twitter: { card: images.length > 0 ? "summary_large_image" : "summary", title: product.name || product.title, description, images },
    other: {
      "product:price:amount": convertMinorAmountToDecimalString(product.price.amountMinor, product.price.currency),
      "product:price:currency": product.price.currency,
      "product:availability": isProductInStock(product) ? "in stock" : "out of stock",
      "og:price:amount": convertMinorAmountToDecimalString(product.price.amountMinor, product.price.currency),
      "og:price:currency": product.price.currency,
    },
  };
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const { slugAndId } = await params;
  const { aff } = await searchParams;
  const product = await loadProductForSlug(slugAndId);
  if (!product) notFound();
  const canonicalPath = buildProductPath(product);
  if (`/p/${slugAndId}` !== canonicalPath && `/p/${encodeURIComponent(decodeURIComponent(slugAndId))}` !== canonicalPath) permanentRedirect(appendAffiliateParameter(canonicalPath, typeof aff === "string" ? aff : undefined));
  const structuredData = [
    buildProductJsonLd(product),
    buildBreadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Mart", path: "/mart" },
      { name: product.store.name, path: buildStorePath(product.store.id) },
      { name: product.name || product.title, path: canonicalPath },
    ]),
    buildOrganizationJsonLd(),
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLdForScriptTag(structuredData) }} />
      <ProductDetailView productId={product.id} initialProduct={product} />
    </>
  );
}
