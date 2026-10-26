"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { ErrorExperienceProvider, type ErrorExperienceConfig, type ErrorLinkProps } from "@nantty/web-kit";

import { buildContactMailtoLink } from "@/constants/contact.constant";
import { verificationRequiredEventName } from "@/services/adsApiClient.service";

function renderNextLink({ href, className, children }: ErrorLinkProps) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function openVerificationPrompt(): void {
  window.dispatchEvent(new CustomEvent(verificationRequiredEventName, { detail: { message: null } }));
}

export const adsErrorExperience: ErrorExperienceConfig = {
  homeHref: "/accounts",
  homeLabel: "Go to your ad accounts",
  hrefs: { signIn: "/login", support: buildContactMailtoLink("Help with Nantty Ads"), browse: "/accounts" },
  handlers: { verify: openVerificationPrompt },
  labels: { browse: "Go to your ad accounts" },
  destinations: [
    { label: "Ad accounts", href: "/accounts", icon: "megaphone" },
    { label: "New ad account", href: "/accounts/new", icon: "squaresFour" },
    { label: "Ad policy", href: "/policy", icon: "shieldCheck" },
  ],
  renderLink: renderNextLink,
};

export function AdsErrorExperienceProvider({ children }: { readonly children: ReactNode }) {
  return <ErrorExperienceProvider value={adsErrorExperience}>{children}</ErrorExperienceProvider>;
}
