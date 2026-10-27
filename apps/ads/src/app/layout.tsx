import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { ConfirmDialogHost, ConnectionStatus, StaticThemeScript, ThemeInitScript, ThemeProvider, parseThemePreference, readHtmlThemeAttribute, themeCookieName, themeViewport } from "@nantty/web-kit";

import { ConsentBannerHost } from "@/components/privacy/consentBannerHost";
import { AdsSessionProvider } from "@/components/session/adsSessionProvider";
import { AppThemeProvider } from "@/components/theme/appThemeProvider";
import { ToastProvider } from "@/components/ui/toastProvider";
import { AdsVerificationProvider } from "@/components/verification/adsVerificationProvider";
import { adsManagerProductName, readPublicSiteUrl } from "@/config/siteMetadata.config";
import { buildSessionViewFromCookies, readCsrfTokenForCookies } from "@/server/adsSessionView.service";

import { AdsErrorExperienceProvider } from "@/components/errors/errorExperience.provider";

import "./globals.css";

const interFont = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(readPublicSiteUrl()),
  title: { default: adsManagerProductName, template: `%s · ${adsManagerProductName}` },
  description: "Create, run and measure Nantty ads for your store, products, posts and clips.",
  applicationName: adsManagerProductName,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_NG",
    siteName: "Nantty Ads",
    title: "Nantty Ads — advertise across the Nantty marketplace",
    description: "Create, run and measure Nantty ads for your store, products, posts and clips.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "Nantty Ads — advertise across the Nantty marketplace",
    description: "Create, run and measure Nantty ads for your store, products, posts and clips.",
  },
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/brand/nantty-icon.png", type: "image/png" }], apple: "/brand/nantty-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  ...themeViewport,
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (process.env.NANTTY_CLOUDFLARE_PRELAUNCH === "1") {
    return (
      <html lang="en-NG" className={interFont.variable} suppressHydrationWarning>
        <head><StaticThemeScript /></head>
        <body><ThemeProvider initialPreference="system">{children}</ThemeProvider></body>
      </html>
    );
  }
  const cookieStore = await cookies();
  const sessionView = buildSessionViewFromCookies(cookieStore);
  const themePreference = parseThemePreference(cookieStore.get(themeCookieName)?.value);
  return (
    <html lang="en-NG" className={interFont.variable} data-theme={readHtmlThemeAttribute(themePreference)} suppressHydrationWarning>
      <head>
        <ThemeInitScript />
      </head>
      <body>
        <a href="#main-content" className="skipToContentLink">
          Skip to content
        </a>
        <ConnectionStatus />
        <AdsSessionProvider initialSessionView={sessionView} csrfToken={readCsrfTokenForCookies(cookieStore)}>
          <AppThemeProvider initialPreference={themePreference} isSignedIn={sessionView !== null}>
            <AdsVerificationProvider isSignedIn={sessionView !== null}>
              <ToastProvider>
                <AdsErrorExperienceProvider>{children}</AdsErrorExperienceProvider>
              </ToastProvider>
              <ConfirmDialogHost />
            </AdsVerificationProvider>
            <ConsentBannerHost isSignedIn={sessionView !== null} />
          </AppThemeProvider>
        </AdsSessionProvider>
      </body>
    </html>
  );
}
