import type { Metadata } from "next";

import { DeveloperLanding } from "@/components/developerLanding";

export const metadata: Metadata = {
  title: { absolute: "Nantty for Developers — Business integrations" },
  description: "Explore Nantty's developer platform, Business Messaging API contract, and isolated sandbox roadmap.",
  robots: { index: true, follow: true },
};

export default function DeveloperHomePage() {
  return <DeveloperLanding />;
}
