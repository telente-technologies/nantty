import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { parseThemePreference, readHtmlThemeAttribute, ThemeInitScript, themeCookieName, themeViewport } from "@zudomart/web-kit";

import { AppProviders } from "@/components/providers/appProviders";
import { deriveCsrfTokenForSession } from "@/server/signedCookie.service";
import { readCachedViewerFromCookies, readSessionIdFromCookies } from "@/server/session.service";

import "./globals.css";

const interFont = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3500"),
  title: { default: "Zudomart", template: "%s · Zudomart" },
  description: "Shop the sellers you already watch.",
  applicationName: "Zudomart",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/brand/favicon.ico", sizes: "48x48" }, { url: "/brand/icon.svg", type: "image/svg+xml" }], apple: "/brand/appleTouchIcon.png" },
  formatDetection: { telephone: false },
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
        <AppProviders viewer={viewer} themePreference={themePreference} csrfToken={sessionId ? deriveCsrfTokenForSession(sessionId) : null}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
