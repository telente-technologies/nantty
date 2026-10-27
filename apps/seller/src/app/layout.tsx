import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { ConfirmDialogHost, ConnectionStatus, StaticThemeScript, ThemeInitScript, ThemeProvider, parseThemePreference, readHtmlThemeAttribute, themeCookieName, themeViewport } from "@nantty/web-kit";

import { ConsentBannerHost } from "@/components/privacy/consentBannerHost";
import { SellerSessionProvider } from "@/components/session/sellerSessionProvider";
import { AppThemeProvider } from "@/components/theme/appThemeProvider";
import { ToastProvider } from "@/components/ui/toastProvider";
import { dashboardProductName, readPublicSiteUrl } from "@/config/siteMetadata.config";
import { buildSellerSessionViewFromCookies, readCsrfTokenForCookies } from "@/server/sellerSessionView.service";

import { SellerErrorExperienceProvider } from "@/components/errors/errorExperience.provider";

import "./globals.css";

const interFont = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const receiptFont = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--font-receipt", weight: ["400", "600"] });

export const metadata: Metadata = {
  metadataBase: new URL(readPublicSiteUrl()),
  title: { default: dashboardProductName, template: `%s · ${dashboardProductName}` },
  description: "Run your Nantty business: products, inventory, app orders, customers, analytics, payouts and team in one place.",
  applicationName: dashboardProductName,
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
  openGraph: { type: "website", siteName: dashboardProductName, title: dashboardProductName, url: "/", locale: "en_NG" },
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
      <html lang="en-NG" className={`${interFont.variable} ${receiptFont.variable}`} suppressHydrationWarning>
        <head><StaticThemeScript /></head>
        <body><ThemeProvider initialPreference="system">{children}</ThemeProvider></body>
      </html>
    );
  }
  const cookieStore = await cookies();
  const sessionView = buildSellerSessionViewFromCookies(cookieStore);
  const csrfToken = readCsrfTokenForCookies(cookieStore);
  const themePreference = parseThemePreference(cookieStore.get(themeCookieName)?.value);
  return (
    <html lang="en-NG" className={`${interFont.variable} ${receiptFont.variable}`} data-theme={readHtmlThemeAttribute(themePreference)} suppressHydrationWarning>
      <head>
        <ThemeInitScript />
      </head>
      <body>
        <a href="#main-content" className="skipToContentLink">
          Skip to content
        </a>
        <ConnectionStatus />
        <SellerSessionProvider initialSessionView={sessionView} csrfToken={csrfToken}>
          <AppThemeProvider initialPreference={themePreference}>
            <ToastProvider>
              <SellerErrorExperienceProvider>{children}</SellerErrorExperienceProvider>
            </ToastProvider>
            <ConfirmDialogHost />
            <ConsentBannerHost isSignedIn={sessionView !== null} />
          </AppThemeProvider>
        </SellerSessionProvider>
      </body>
    </html>
  );
}
