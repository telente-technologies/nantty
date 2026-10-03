import type { Metadata } from "next";

import { EmailTemplatesWorkspace } from "@/components/emailTemplates/emailTemplatesWorkspace";

export const metadata: Metadata = { title: "Email templates" };

export default function EmailTemplatesPage() {
  return <EmailTemplatesWorkspace />;
}
