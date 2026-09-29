import type { Metadata } from "next";

import { BrandMembersView } from "@/components/brand/brandMembersView";

export const metadata: Metadata = { title: "Brand members" };

export default function BrandMembersPage() {
  return <BrandMembersView />;
}
