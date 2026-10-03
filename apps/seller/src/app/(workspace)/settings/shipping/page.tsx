import type { Metadata } from "next";

import { ShippingConfigView } from "@/components/delivery/shipping/shippingConfigView";

export const metadata: Metadata = { title: "Shipping settings" };

export default function ShippingSettingsPage() {
  return <ShippingConfigView />;
}
