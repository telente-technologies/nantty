import type { Metadata } from "next";

import { ConversionEventsPage } from "@/components/tools/conversionEventsPage";

export const metadata: Metadata = { title: "Conversion events" };

export default function Page() {
  return <ConversionEventsPage />;
}
