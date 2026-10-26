"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { ErrorExperienceProvider, type ErrorExperienceConfig, type ErrorLinkProps } from "@nantty/web-kit";

import { webappLinks } from "@/config/webappLinks.config";
import { buildContactMailtoLink } from "@/constants/contact.constant";

function renderNextLink({ href, className, children }: ErrorLinkProps) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export const studioErrorExperience: ErrorExperienceConfig = {
  homeHref: "/home",
  homeLabel: "Back to the studio",
  hrefs: { signIn: "/login", accountStatus: webappLinks.accountStatus, appeal: webappLinks.accountStatus, support: buildContactMailtoLink("Help with Nantty Studio"), browse: "/home", useApp: webappLinks.help, manageProfiles: webappLinks.manageProfiles },
  labels: { browse: "Back to the studio" },
  destinations: [
    { label: "Home", href: "/home", icon: "house" },
    { label: "Content", href: "/content", icon: "playCircle" },
    { label: "Lives", href: "/lives", icon: "broadcast" },
    { label: "Earnings", href: "/earnings", icon: "wallet" },
    { label: "Analytics", href: "/analytics", icon: "users" },
  ],
  renderLink: renderNextLink,
};

export function StudioErrorExperienceProvider({ children }: { readonly children: ReactNode }) {
  return <ErrorExperienceProvider value={studioErrorExperience}>{children}</ErrorExperienceProvider>;
}
