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

const contactEmailRecipients = ["oyinlola.tech@icloud.com", "oluwayemioyinlola2@icloud.com"] as const;

export const contactMailtoHref = `mailto:${contactEmailRecipients.join(",")}`;
export const contactEmailDisplayText = contactEmailRecipients.join(" and ");

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
    { label: "Sell", href: "/sellers" },
    { label: "About", href: "/about" },
  ] satisfies readonly SiteNavigationLink[],
} as const;
