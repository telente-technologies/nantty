"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ErrorExperienceProvider, type ErrorDestination, type ErrorExperienceConfig, type ErrorLinkProps } from "@zudomart/web-kit";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { useAuthPromptStore } from "@/components/auth/authPrompt.store";
import { CountryRequiredDialog } from "@/components/commerce/countryRequiredDialog";
import { storeLinks } from "@/config/brandContact.config";

export const webappHomeHref = "/";

export const webappDestinations: readonly ErrorDestination[] = [
  { label: "Feed", href: "/", icon: "house" },
  { label: "Clips", href: "/clips", icon: "playCircle" },
  { label: "Mart", href: "/mart", icon: "storefront" },
  { label: "Live", href: "/live", icon: "broadcast" },
];

function renderNextLink({ href, className, children }: ErrorLinkProps) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function buildWebappErrorConfig(handlers: ErrorExperienceConfig["handlers"] = {}): ErrorExperienceConfig {
  const appHref = storeLinks.playStoreUrl ?? storeLinks.appStoreUrl ?? undefined;
  return {
    homeHref: webappHomeHref,
    renderLink: renderNextLink,
    searchHref: "/explore",
    searchPlaceholder: "Search people, products and stores",
    destinations: webappDestinations,
    hrefs: {
      signIn: "/login",
      verify: "/settings/verification",
      accountStatus: "/settings/account-status",
      appeal: "/settings/account-status",
      support: "/help",
      upgrade: "/settings/verification",
      viewCart: "/cart",
      viewOrders: "/orders",
      resendEmail: "/verify-email",
      browse: "/explore",
      changeAddress: "/settings/addresses",
      payByCard: "/cart",
      clearDebt: "/wallet",
      ...(appHref ? { useApp: appHref, update: appHref } : {}),
    },
    handlers,
  };
}

export function WebappErrorExperienceProvider({ children }: { readonly children: ReactNode }) {
  const queryClient = useQueryClient();
  const openAuthPrompt = useAuthPromptStore((state) => state.openAuthPrompt);
  const [isCountryDialogOpen, setCountryDialogOpen] = useState(false);
  const config = useMemo(
    () =>
      buildWebappErrorConfig({
        signIn: () => openAuthPrompt("Sign in to continue. Anything you were doing will pick up where you left off."),
        chooseCountry: () => setCountryDialogOpen(true),
      }),
    [openAuthPrompt],
  );
  return (
    <ErrorExperienceProvider value={config}>
      {children}
      <CountryRequiredDialog
        isOpen={isCountryDialogOpen}
        onClose={() => setCountryDialogOpen(false)}
        onSaved={() => {
          setCountryDialogOpen(false);
          void queryClient.invalidateQueries();
        }}
      />
    </ErrorExperienceProvider>
  );
}
