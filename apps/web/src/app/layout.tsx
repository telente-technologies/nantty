import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import { CookieConsentBanner, OfflineBanner, ThemeInitScript, themeViewport } from "@nantty/web-kit";

import { MarketingErrorExperienceProvider } from "@/components/errors/errorExperience.provider";
import { LaunchAnnouncementBar } from "@/components/layout/announcementBar";
import { SiteFooterWithGiantWordmark } from "@/components/layout/siteFooter";
import { SiteHeaderWithFloatingNavigation } from "@/components/layout/siteHeader";
import { SiteThemeProvider } from "@/components/layout/siteThemeProvider";
import { siteConfig } from "@/lib/siteConfig.config";
import "./globals.css";

const interFont = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: "Nantty — Shop the sellers you already watch",
    template: "%s · Nantty",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: ["Nantty", "Nigeria marketplace", "social commerce", "live shopping", "live streaming", "creator gifts", "escrow", "buy online Nigeria", "sell online Nigeria"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_NG",
    siteName: siteConfig.name,
    title: "Nantty — Shop the sellers you already watch",
    description: siteConfig.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nantty — Shop the sellers you already watch",
    description: siteConfig.description,
  },
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/brand/nantty-icon.png", type: "image/png" }], apple: "/brand/nantty-icon.png" },
  formatDetection: { telephone: false },
};

const organizationJsonLd = JSON.stringify([
  { "@context": "https://schema.org", "@type": "Organization", name: "Nantty", url: siteConfig.siteUrl, logo: `${siteConfig.siteUrl}/brand/nantty-icon.png` },
  { "@context": "https://schema.org", "@type": "WebSite", name: "Nantty", url: siteConfig.siteUrl },
]).replace(/</g, "\\u003c");

export const viewport: Viewport = {
  ...themeViewport,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-NG" className={interFont.variable} suppressHydrationWarning>
      <head>
        <ThemeInitScript />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJsonLd }} />
      </head>
      <body>
        <SiteThemeProvider>
        <MarketingErrorExperienceProvider>
        <a href="#main-content" className="skipToContentLink">
          Skip to content
        </a>
        <OfflineBanner message="You're offline. Check your data or Wi-Fi. Some pages and images may not load until you reconnect." />
        <LaunchAnnouncementBar />
        <SiteHeaderWithFloatingNavigation />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <SiteFooterWithGiantWordmark />
        <CookieConsentBanner />
        </MarketingErrorExperienceProvider>
        </SiteThemeProvider>
      </body>
    </html>
  );
}
