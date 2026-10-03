import type { Metadata } from "next";

import { DeliveryAreasManager } from "@/components/delivery/deliveryAreasManager";
import { deliverySectionTabs } from "@/components/delivery/deliveryPresentation.constant";
import { LinkTabs } from "@/components/ui/navigationTabs";
import { PageHeader, PageStack } from "@/components/ui/panel";

export const metadata: Metadata = { title: "Delivery areas & fees" };

export default function DeliveryAreasPage() {
  return (
    <PageStack>
      <PageHeader title="Delivery" description="Track every app order from packing to the customer's door." />
      <LinkTabs label="Delivery sections" tabs={deliverySectionTabs} />
      <DeliveryAreasManager />
    </PageStack>
  );
}
