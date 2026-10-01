"use client";

import { use } from "react";

import { ProductCollectionBrowser } from "@/components/commerce/productCollectionBrowser";
import { productsService } from "@/services/products.service";
import { useQuery } from "@tanstack/react-query";

export default function CategoryPage({ params }: { readonly params: Promise<{ readonly categoryId: string }> }) {
  const { categoryId } = use(params);
  const martHome = useQuery({ queryKey: ["mart", "home"], queryFn: productsService.fetchMartHome, retry: false });
  const title = martHome.data?.categories.find((category) => category.id === categoryId)?.name ?? "Category";

  return <ProductCollectionBrowser title={title} categoryId={categoryId} />;
}
