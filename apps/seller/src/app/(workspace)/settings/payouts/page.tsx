import type { Metadata } from "next";
import { Suspense } from "react";

import { PayoutOnboardingPanel } from "@/components/payouts/payoutOnboardingPanel";
import { PayoutAccountsView } from "@/components/wallet/payoutAccountsView";
import { PayoutScheduleForm } from "@/components/wallet/payoutScheduleForm";

export const metadata: Metadata = { title: "Payment & withdrawal" };

export default function PayoutSettingsPage() {
  return (
    <>
      <Suspense fallback={null}>
        <PayoutOnboardingPanel context="seller" />
      </Suspense>
      <PayoutScheduleForm />
      <PayoutAccountsView embedded />
    </>
  );
}
