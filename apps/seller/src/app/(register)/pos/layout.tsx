import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PosRegisterShell } from "@/components/pos/posRegisterShell";

export const metadata: Metadata = { title: "Register" };

export default function PosRegisterLayout({ children }: { readonly children: ReactNode }) {
  return <PosRegisterShell>{children}</PosRegisterShell>;
}
