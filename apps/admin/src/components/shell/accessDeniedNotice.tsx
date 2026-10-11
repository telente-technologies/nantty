"use client";

import { useSearchParams } from "next/navigation";

import { NoticeBanner } from "@/components/ui/feedback";

export function AccessDeniedNotice() {
  const deniedPath = useSearchParams().get("denied");
  if (!deniedPath) return null;
  return (
    <NoticeBanner tone="caution" title="You don't have access to that page">
      {deniedPath.slice(0, 120)} needs a permission your role doesn't include. You were sent to the first page you can use. Ask a superadmin if you need it.
    </NoticeBanner>
  );
}
