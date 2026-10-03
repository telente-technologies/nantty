import type { Metadata } from "next";

import { DeliveryAreasManager } from "@/components/delivery/deliveryAreasManager";

export const metadata: Metadata = { title: "Delivery settings" };

export default function DeliverySettingsPage() {
  return <DeliveryAreasManager />;
}
