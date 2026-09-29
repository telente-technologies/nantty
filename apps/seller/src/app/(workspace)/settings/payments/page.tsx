import type { Metadata } from "next";

import { PaymentMethodsSettingsView } from "@/components/settings/paymentMethodsSettingsForm";

export const metadata: Metadata = { title: "Payment methods" };

export default function PaymentMethodsSettingsPage() {
  return <PaymentMethodsSettingsView />;
}
