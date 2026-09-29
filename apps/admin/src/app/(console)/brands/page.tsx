import type { Metadata } from "next";
import { Suspense } from "react";

import { BrandDirectoryWorkspace } from "@/components/brands/brandDirectoryWorkspace";

export const metadata: Metadata = { title: "Brands" };

export default function BrandsPage() {
  return (
    <Suspense>
      <BrandDirectoryWorkspace />
    </Suspense>
  );
}
