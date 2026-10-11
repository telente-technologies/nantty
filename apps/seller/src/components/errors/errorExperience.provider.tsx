"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { ErrorExperienceProvider, type ErrorExperienceConfig, type ErrorLinkProps } from "@zudomart/web-kit";

import { contactMailtoHref } from "@/config/siteMetadata.config";

function renderNextLink({ href, className, children }: ErrorLinkProps) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export const sellerErrorExperience: ErrorExperienceConfig = {
  homeHref: "/dashboard",
  homeLabel: "Back to your dashboard",
  hrefs: {
    signIn: "/login",
    verify: "/settings/verification",
    upgrade: "/settings/billing",
    support: contactMailtoHref,
    viewOrders: "/orders",
    browse: "/dashboard",
    clearDebt: "/wallet",
    manageProfiles: "/brand",
  },
  labels: { upgrade: "See seller plans", browse: "Back to your dashboard" },
  destinations: [
    { label: "Orders", href: "/orders", icon: "receipt" },
    { label: "Products", href: "/products", icon: "package" },
    { label: "Messages", href: "/messages", icon: "chatsCircle" },
    { label: "Payments", href: "/wallet", icon: "wallet" },
    { label: "Analytics", href: "/analytics", icon: "chartLine" },
  ],
  renderLink: renderNextLink,
};

export function SellerErrorExperienceProvider({ children }: { readonly children: ReactNode }) {
  return <ErrorExperienceProvider value={sellerErrorExperience}>{children}</ErrorExperienceProvider>;
}
