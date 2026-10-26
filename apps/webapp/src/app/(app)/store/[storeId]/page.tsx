import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { fetchPublicStore, fetchPublicStoreProducts } from "@/server/publicContent.service";
import { buildAbsoluteSiteUrl, buildStorePath } from "@/utils/seoPaths.util";
import { buildBreadcrumbJsonLd, buildOrganizationJsonLd, buildStoreJsonLd, serializeJsonLdForScriptTag } from "@/utils/structuredData.util";

import { StoreDetailView } from "./storeDetailView";

interface StorePageProps {
  readonly params: Promise<{ readonly storeId: string }>;
}

export async function generateMetadata({ params }: StorePageProps): Promise<Metadata> {
  const store = await fetchPublicStore(decodeURIComponent((await params).storeId));
  if (!store) return { title: "Store not found", robots: { index: false } };
  const canonicalUrl = buildAbsoluteSiteUrl(buildStorePath(store.id));
  const description = (store.bio || `Shop ${store.productsCount} products from ${store.name} on Nantty, with escrow-protected payments.`).replace(/\s+/g, " ").slice(0, 160);
  const images = [store.bannerUrl, store.logoUrl].filter((image): image is string => !!image);
  return {
    title: `${store.name} store`,
    description,
    alternates: { canonical: canonicalUrl, languages: { "en-NG": canonicalUrl, "x-default": canonicalUrl } },
    openGraph: { type: "website", url: canonicalUrl, siteName: "Nantty", title: store.name, description, images: images.map((url) => ({ url, alt: store.name })) },
    twitter: { card: store.bannerUrl ? "summary_large_image" : "summary", title: store.name, description, images },
  };
}

export default async function StorePage({ params }: StorePageProps) {
  const storeId = decodeURIComponent((await params).storeId);
  const [store, products] = await Promise.all([fetchPublicStore(storeId), fetchPublicStoreProducts(storeId)]);
  if (!store) notFound();
  const structuredData = [
    buildStoreJsonLd(store),
    buildBreadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Mart", path: "/mart" }, { name: store.name, path: buildStorePath(store.id) }]),
    buildOrganizationJsonLd(),
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLdForScriptTag(structuredData) }} />
      <StoreDetailView initialStore={store} initialProducts={products} />
    </>
  );
}
