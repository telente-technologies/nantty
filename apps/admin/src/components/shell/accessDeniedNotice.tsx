"use client";

import { useSearchParams } from "next/navigation";

import { describeAdminPermission } from "@/components/errors/errorExperience.provider";
import { NoticeBanner } from "@/components/ui/feedback";
import { findRequirementForPagePath, type PageRequirement } from "@/config/navigation.config";

function describeRequirement(requirement: PageRequirement | null): string | null {
  if (!requirement || requirement === "ANY_ADMIN") return null;
  if (requirement === "SUPERADMIN") return "Superadmin";
  const first = typeof requirement === "string" ? requirement : requirement[0];
  return first ? (describeAdminPermission(first) ?? first) : null;
}

export function AccessDeniedNotice() {
  const deniedPath = useSearchParams().get("denied");
  if (!deniedPath) return null;
  const permissionLabel = describeRequirement(findRequirementForPagePath(deniedPath));
  return (
    <NoticeBanner tone="caution" title="You don't have access to that page">
      {permissionLabel ? `You don't have the "${permissionLabel}" permission needed for ${deniedPath.slice(0, 120)}.` : `${deniedPath.slice(0, 120)} needs a permission your role doesn't include.`} You were sent to the first page you can use. Ask a superadmin if you need it.
    </NoticeBanner>
  );
}
