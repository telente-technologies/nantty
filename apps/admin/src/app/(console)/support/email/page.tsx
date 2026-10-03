import type { Metadata } from "next";

import { EmailOutreachWorkspace } from "@/components/support/emailOutreachWorkspace";

export const metadata: Metadata = { title: "Email" };

export default function EmailPage() {
  return <EmailOutreachWorkspace />;
}
