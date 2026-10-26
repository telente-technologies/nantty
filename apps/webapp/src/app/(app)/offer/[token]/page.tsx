import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SubscriptionOfferView } from "@/components/subscriptionOffers/subscriptionOfferView";
import { Spinner } from "@/components/ui/feedback";
import { readOfferTokenFromPath } from "@/utils/subscriptionOfferCopy.util";

export const metadata: Metadata = { title: "Your Nantty offer", robots: { index: false, follow: false }, referrer: "no-referrer" };

interface OfferPageProps {
  readonly params: Promise<{ readonly token: string }>;
}

export default async function OfferPage({ params }: OfferPageProps) {
  const token = readOfferTokenFromPath((await params).token);
  if (!token) notFound();
  return (
    <Suspense fallback={<Spinner label="Opening your offer" />}>
      <SubscriptionOfferView token={token} />
    </Suspense>
  );
}
