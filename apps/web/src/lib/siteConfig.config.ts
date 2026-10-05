import { buildMailtoHref, buildStoreLinks, buildZudomartEmailAddresses } from "@zudomart/web-kit";

export interface SiteNavigationLink {
  readonly label: string;
  readonly href: string;
}

const fallbackSiteUrl = "https://zudomart.com";

function readPublicSiteUrl(): string {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredSiteUrl) return fallbackSiteUrl;
  try {
    return new URL(configuredSiteUrl).origin;
  } catch {
    return fallbackSiteUrl;
  }
}

const isDevelopmentEnvironment = process.env.NODE_ENV === "development";

function readBusinessAppUrl(configuredUrl: string | undefined, productionUrl: string, developmentUrl: string): string {
  const fallbackUrl = isDevelopmentEnvironment ? developmentUrl : productionUrl;
  if (!configuredUrl) return fallbackUrl;
  try {
    return new URL(configuredUrl).origin;
  } catch {
    return fallbackUrl;
  }
}

export const businessAppLinks = {
  sellerDashboard: {
    label: "Zudomart Dashboard",
    description: "Products, inventory, orders, customers and reports. Free for every seller.",
    href: readBusinessAppUrl(process.env.NEXT_PUBLIC_DASHBOARD_URL, "https://dashboard.zudomart.com", "http://localhost:3200"),
  },
  adsManager: {
    label: "Zudomart Ads",
    description: "Promote your posts, clips, lives and products to buyers on Zudomart.",
    href: readBusinessAppUrl(process.env.NEXT_PUBLIC_ADS_MANAGER_URL, "https://ads.zudomart.com", "http://localhost:3300"),
  },
} as const;

export const webAppLink = {
  label: "Open the web app",
  href: readBusinessAppUrl(process.env.NEXT_PUBLIC_WEBAPP_URL, "https://app.zudomart.com", "http://localhost:3500"),
} as const;

export const emailAddresses = buildZudomartEmailAddresses({
  domain: process.env.NEXT_PUBLIC_MAIL_DOMAIN,
  overrides: { support: process.env.NEXT_PUBLIC_SUPPORT_EMAIL, privacy: process.env.NEXT_PUBLIC_PRIVACY_EMAIL, legal: process.env.NEXT_PUBLIC_LEGAL_EMAIL },
});

export const storeLinks = buildStoreLinks({ appStoreId: process.env.NEXT_PUBLIC_APP_STORE_ID, playPackage: process.env.NEXT_PUBLIC_PLAY_PACKAGE });

const contactEmailRecipients = [emailAddresses.support] as const;

export const contactMailtoHref = buildMailtoHref(emailAddresses.support);
export const contactEmailDisplayText = emailAddresses.support;

export const siteConfig = {
  name: "Zudomart",
  wordmark: "zudomart",
  tagline: "Shop the sellers you already watch.",
  description:
    "Zudomart is a Nigerian social marketplace. Discover real sellers through posts, clips, stories and live shopping, and pay in your local currency with your money held in escrow until you confirm delivery.",
  siteUrl: readPublicSiteUrl(),
  launchCountry: "Nigeria",
  contactEmailRecipients,
  primaryNavigation: [
    { label: "How it works", href: "/#how-it-works" },
    { label: "Escrow", href: "/#escrow" },
    { label: "Creators", href: "/#creators" },
    { label: "About", href: "/about" },
  ] satisfies readonly SiteNavigationLink[],
} as const;
