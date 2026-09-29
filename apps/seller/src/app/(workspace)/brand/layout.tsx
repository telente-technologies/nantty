import type { ReactNode } from "react";

import { BrandWorkspace } from "@/components/brand/brandWorkspace";

export default function BrandLayout({ children }: { readonly children: ReactNode }) {
  return <BrandWorkspace>{children}</BrandWorkspace>;
}
