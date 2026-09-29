import type { Metadata } from "next";
import { Suspense } from "react";

import { AuditLogWorkspace } from "@/components/audit/auditLogWorkspace";

export const metadata: Metadata = { title: "Audit log" };

export default function AuditLogPage() {
  return (
    <Suspense>
      <AuditLogWorkspace />
    </Suspense>
  );
}
