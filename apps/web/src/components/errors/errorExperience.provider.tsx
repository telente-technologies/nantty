"use client";

import { ErrorExperienceProvider, type ErrorExperienceConfig, type ErrorLinkProps } from "@nantty/web-kit";
import Link from "next/link";
import type { ReactNode } from "react";

import { contactMailtoHref, storeLinks, webAppLink } from "@/lib/siteConfig.config";

function renderNextLink({ href, className, children }: ErrorLinkProps) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

const appHref = storeLinks.playStoreUrl ?? storeLinks.appStoreUrl ?? webAppLink.href;

export const marketingErrorConfig: ErrorExperienceConfig = {
  homeHref: "/",
  homeLabel: "Back to the homepage",
  renderLink: renderNextLink,
  destinations: [
    { label: "Home", href: "/", icon: "house" },
    { label: "Sell on Nantty", href: "/sellers", icon: "storefront" },
    { label: "About", href: "/about", icon: "compass" },
    { label: "Contact", href: "/contact", icon: "envelope" },
    { label: "Open the web app", href: webAppLink.href, icon: "squaresFour" },
  ],
  hrefs: { support: contactMailtoHref, browse: "/", useApp: appHref, update: appHref, signIn: `${webAppLink.href}/login` },
};

export function MarketingErrorExperienceProvider({ children }: { readonly children: ReactNode }) {
  return <ErrorExperienceProvider value={marketingErrorConfig}>{children}</ErrorExperienceProvider>;
}
