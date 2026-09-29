import type { Metadata } from "next";

import { AppealsWorkspace } from "@/components/trust/appealsWorkspace";

export const metadata: Metadata = { title: "Appeals" };

export default function ModerationAppealsPage() {
  return <AppealsWorkspace />;
}
