import type { Metadata } from "next";

import { CategoriesWorkspace } from "@/components/catalog/categoriesWorkspace";

export const metadata: Metadata = { title: "Categories" };

export default function CategoriesPage() {
  return <CategoriesWorkspace />;
}
