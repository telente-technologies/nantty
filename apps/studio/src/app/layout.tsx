import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { ThemeInitScript, ThemeProvider, parseThemePreference, readHtmlThemeAttribute, themeCookieName, themeViewport } from "@nantty/web-kit";

import { readPublicSiteUrl } from "@/config/studioEnvironment.config";
import { deriveCsrfTokenForSession } from "@/server/signedCookie.service";
import { readCachedViewerFromCookies, readSessionIdFromCookies } from "@/server/session.service";

import "./globals.css";

const interFont = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(readPublicSiteUrl()),
  title: { default: "Nantty Studio", template: "%s · Nantty Studio" },
  description: "Go live on Nantty: talk, music, gaming and more, with OBS, overlays, gifts and analytics.",
  applicationName: "Nantty Studio",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/brand/nantty-icon.png", type: "image/png" }], apple: "/brand/nantty-icon.png" },
  formatDetection: { telephone: false },
  robots: process.env.NANTTY_CLOUDFLARE_PRELAUNCH === "1" ? { index: true, follow: true } : { index: false, follow: false },
};

export const viewport: Viewport = {
  ...themeViewport,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (process.env.NANTTY_CLOUDFLARE_PRELAUNCH === "1") {
    return (
      <html lang="en-NG" className={interFont.variable} data-theme="light">
        <body><ThemeProvider initialPreference="light">{children}</ThemeProvider></body>
      </html>
    );
  }
  const cookieStore = await cookies();
  const sessionId = readSessionIdFromCookies(cookieStore);
  const viewer = readCachedViewerFromCookies(cookieStore);
  const themePreference = parseThemePreference(cookieStore.get(themeCookieName)?.value);
  const { AppProviders } = await import("@/components/providers/appProviders");

  return (
    <html lang="en-NG" className={interFont.variable} data-theme={readHtmlThemeAttribute(themePreference)} suppressHydrationWarning>
      <head>
        <ThemeInitScript />
      </head>
      <body>
        <a href="#main-content" className="skipToContentLink">
          Skip to content
        </a>
        <AppProviders viewer={viewer} csrfToken={sessionId ? deriveCsrfTokenForSession(sessionId) : null} themePreference={themePreference}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
