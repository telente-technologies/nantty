import type { Metadata } from "next";

import { ReturnsListView } from "@/components/orders/returnsListView";

export const metadata: Metadata = { title: "Returns" };

export default function ReturnsPage() {
  return <ReturnsListView />;
}
