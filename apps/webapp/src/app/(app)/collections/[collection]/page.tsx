"use client";

import { use } from "react";

import { ProductCollectionBrowser } from "@/components/commerce/productCollectionBrowser";
import type { ProductCollection } from "@/types/commerce.type";

const collectionTitles: Record<ProductCollection, string> = {
  sales_of_the_day: "Sales of the Day",
  featured_brands: "Featured Brands",
  new_arrivals: "New Arrivals",
};

export default function CollectionPage({ params }: { readonly params: Promise<{ readonly collection: string }> }) {
  const { collection } = use(params);
  const knownCollection = collection as ProductCollection;
  const title = collectionTitles[knownCollection] ?? "Collection";

  return <ProductCollectionBrowser title={title} collection={collectionTitles[knownCollection] ? knownCollection : undefined} />;
}
