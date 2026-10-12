import type { Metadata } from "next";

import { SubscriptionOffersWorkspace } from "@/components/configuration/offers/subscriptionOffersWorkspace";

export const metadata: Metadata = { title: "Subscription offers" };

export default function SubscriptionOffersPage() {
  return <SubscriptionOffersWorkspace />;
}
