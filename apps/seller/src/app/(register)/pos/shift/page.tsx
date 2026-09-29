import type { Metadata } from "next";

import { PosShiftManagementView } from "@/components/pos/posShiftManagementView";

export const metadata: Metadata = { title: "Shift and cash drawer" };

export default function ShiftAndCashDrawerPage() {
  return <PosShiftManagementView />;
}
