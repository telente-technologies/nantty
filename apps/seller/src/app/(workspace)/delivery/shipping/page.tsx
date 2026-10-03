import type { Metadata } from "next";

import { deliverySectionTabs } from "@/components/delivery/deliveryPresentation.constant";
import { ShippingConfigView } from "@/components/delivery/shipping/shippingConfigView";
import { LinkTabs } from "@/components/ui/navigationTabs";
import { PageHeader, PageStack } from "@/components/ui/panel";

export const metadata: Metadata = { title: "Shipping rules" };

export default function DeliveryShippingPage() {
  return (
    <PageStack>
      <PageHeader title="Delivery" description="Track every app order from packing to the customer's door." />
      <LinkTabs label="Delivery sections" tabs={deliverySectionTabs} />
      <ShippingConfigView />
    </PageStack>
  );
}
