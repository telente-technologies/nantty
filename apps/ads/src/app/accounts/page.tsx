import type { Metadata } from "next";
import { Suspense } from "react";

import { AccountChooser } from "@/components/accounts/accountChooser";
import { StandaloneFrame } from "@/components/shell/standaloneFrame";

export const metadata: Metadata = { title: "Ad accounts" };

export default function AccountsPage() {
  return (
    <StandaloneFrame>
      <Suspense fallback={null}>
        <AccountChooser />
      </Suspense>
    </StandaloneFrame>
  );
}
