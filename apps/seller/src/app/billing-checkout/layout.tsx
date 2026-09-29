import type { ReactNode } from "react";

import { GateFrame } from "@/components/billing/gateFrame";

export default function BillingCheckoutLayout({ children }: { readonly children: ReactNode }) {
  return <GateFrame>{children}</GateFrame>;
}
