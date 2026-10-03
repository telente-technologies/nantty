import type { Metadata } from "next";

import { StorefrontView } from "@/components/storefront/storefrontView";

export const metadata: Metadata = { title: "Storefront" };

export default function StorefrontPage() {
  return <StorefrontView />;
}
