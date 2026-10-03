import type { Metadata } from "next";

import { SuppliersView } from "@/components/inventory/suppliersView";

export const metadata: Metadata = { title: "Suppliers" };

export default function SuppliersPage() {
  return <SuppliersView />;
}
