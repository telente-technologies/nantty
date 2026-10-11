"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { ErrorExperienceProvider, buildMailtoHref, type ErrorExperienceConfig, type ErrorLinkProps } from "@zudomart/web-kit";

import { adminPermissionGroups } from "@/constants/adminPermissions.constant";
import { adminSupportContactEmails } from "@/constants/supportContacts.constant";
import { requestStepUpFromUser } from "@/services/adminApiClient.service";

const permissionLabels = new Map<string, string>(adminPermissionGroups.flatMap((group) => group.permissions.map((permission) => [permission.key, permission.label] as const)));

export function describeAdminPermission(permissionKey: string): string | undefined {
  if (permissionKey === "superadmin") return "Superadmin";
  return permissionLabels.get(permissionKey);
}

function renderNextLink({ href, className, children }: ErrorLinkProps) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export const adminErrorExperience: ErrorExperienceConfig = {
  homeHref: "/",
  homeLabel: "Go to the console",
  hrefs: { signIn: "/login", support: buildMailtoHref(adminSupportContactEmails[0], "Admin console access") },
  handlers: { stepUp: () => void requestStepUpFromUser().then((confirmed) => confirmed && window.location.reload()) },
  labels: { support: "Ask for access" },
  describePermission: describeAdminPermission,
  searchHref: "/users",
  searchParam: "search",
  searchPlaceholder: "Search users by name, email or ID",
  destinations: [
    { label: "Overview", href: "/overview", icon: "chartLine" },
    { label: "Users", href: "/users", icon: "users" },
    { label: "Verification", href: "/verification", icon: "sealCheck" },
    { label: "Audit log", href: "/audit", icon: "receipt" },
  ],
  renderLink: renderNextLink,
};

export function AdminErrorExperienceProvider({ children }: { readonly children: ReactNode }) {
  return <ErrorExperienceProvider value={adminErrorExperience}>{children}</ErrorExperienceProvider>;
}
