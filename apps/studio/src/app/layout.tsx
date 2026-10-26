import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { ThemeInitScript, parseThemePreference, readHtmlThemeAttribute, themeCookieName, themeViewport } from "@nantty/web-kit";

import { AppProviders } from "@/components/providers/appProviders";
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
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  ...themeViewport,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const sessionId = readSessionIdFromCookies(cookieStore);
  const viewer = readCachedViewerFromCookies(cookieStore);
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
        <AppProviders viewer={viewer} csrfToken={sessionId ? deriveCsrfTokenForSession(sessionId) : null} themePreference={themePreference}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
