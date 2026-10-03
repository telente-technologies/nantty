import type { Metadata } from "next";

import { PayoutAccountsView } from "@/components/wallet/payoutAccountsView";
import { PayoutScheduleForm } from "@/components/wallet/payoutScheduleForm";

export const metadata: Metadata = { title: "Payment & withdrawal" };

export default function PayoutSettingsPage() {
  return (
    <>
      <PayoutScheduleForm />
      <PayoutAccountsView embedded />
    </>
  );
}
