import type { Metadata } from "next";

import { PosRegisterView } from "@/components/pos/posRegisterView";

export const metadata: Metadata = { title: "Point of sale" };

export default function PointOfSalePage() {
  return <PosRegisterView />;
}
