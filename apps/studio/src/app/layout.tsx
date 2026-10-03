import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { AppProviders } from "@/components/providers/appProviders";
import { readPublicSiteUrl } from "@/config/studioEnvironment.config";
import { deriveCsrfTokenForSession } from "@/server/signedCookie.service";
import { readCachedViewerFromCookies, readSessionIdFromCookies } from "@/server/session.service";

import "./globals.css";

const interFont = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(readPublicSiteUrl()),
  title: { default: "Zudomart Studio", template: "%s · Zudomart Studio" },
  description: "Go live on Zudomart: talk, music, gaming and more, with OBS, overlays, gifts and analytics.",
  applicationName: "Zudomart Studio",
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#2043F5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const sessionId = readSessionIdFromCookies(cookieStore);
  const viewer = readCachedViewerFromCookies(cookieStore);

  return (
    <html lang="en-NG" className={interFont.variable}>
      <body>
        <a href="#main-content" className="skipToContentLink">
          Skip to content
        </a>
        <AppProviders viewer={viewer} csrfToken={sessionId ? deriveCsrfTokenForSession(sessionId) : null}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
