import type { Metadata } from "next";

import { AdvertisersWorkspace } from "@/components/trust/advertisersWorkspace";

export const metadata: Metadata = { title: "Advertisers" };

export default function AdvertisersPage() {
  return <AdvertisersWorkspace />;
}
