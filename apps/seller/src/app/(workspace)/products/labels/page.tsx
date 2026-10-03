import type { Metadata } from "next";

import { BarcodeLabelsView } from "@/components/catalog/barcodeLabelsView";

export const metadata: Metadata = { title: "Product labels" };

export default function BarcodeLabelsPage() {
  return <BarcodeLabelsView />;
}
