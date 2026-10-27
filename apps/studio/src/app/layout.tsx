import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { StaticThemeScript, ThemeInitScript, ThemeProvider, parseThemePreference, readHtmlThemeAttribute, themeCookieName, themeViewport } from "@nantty/web-kit";

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
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_NG",
    siteName: "Nantty Studio",
    title: "Nantty Studio — the creator studio for going live",
    description: "A creator home for going live on Nantty, with OBS support, overlays, audience tools and creator analytics.",
    url: "/",
    images: [{ url: "/photos/creatorMicPortrait.webp", width: 1000, height: 1400, alt: "A creator speaking into a studio microphone" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nantty Studio — the creator studio for going live",
    description: "A creator home for going live on Nantty, with OBS support, overlays, audience tools and creator analytics.",
    images: ["/photos/creatorMicPortrait.webp"],
  },
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
  if (process.env.NANTTY_CLOUDFLARE_PRELAUNCH === "1") {
    return (
      <html lang="en-NG" className={interFont.variable} suppressHydrationWarning>
        <head><StaticThemeScript /></head>
        <body><ThemeProvider initialPreference="system">{children}</ThemeProvider></body>
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
