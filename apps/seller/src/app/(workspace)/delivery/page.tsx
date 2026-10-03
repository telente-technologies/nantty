import type { Metadata } from "next";

import { DeliveryPipelineView } from "@/components/delivery/deliveryPipelineView";

export const metadata: Metadata = { title: "Delivery" };

export default function DeliveryPage() {
  return <DeliveryPipelineView />;
}
