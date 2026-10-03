import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { ConsentBannerHost } from "@/components/privacy/consentBannerHost";
import { AdsSessionProvider } from "@/components/session/adsSessionProvider";
import { ToastProvider } from "@/components/ui/toastProvider";
import { adsManagerProductName, readPublicSiteUrl } from "@/config/siteMetadata.config";
import { buildSessionViewFromCookies, readCsrfTokenForCookies } from "@/server/adsSessionView.service";

import "./globals.css";

const interFont = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(readPublicSiteUrl()),
  title: { default: adsManagerProductName, template: `%s · ${adsManagerProductName}` },
  description: "Create, run and measure Zudomart ads for your store, products, posts and clips.",
  applicationName: adsManagerProductName,
  robots: { index: false, follow: false },
  icons: { icon: "/icons/appIcon.svg" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0B1752",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const sessionView = buildSessionViewFromCookies(cookieStore);
  return (
    <html lang="en-NG" className={interFont.variable}>
      <body>
        <a href="#main-content" className="skipToContentLink">
          Skip to content
        </a>
        <AdsSessionProvider initialSessionView={sessionView} csrfToken={readCsrfTokenForCookies(cookieStore)}>
          <ToastProvider>{children}</ToastProvider>
          <ConsentBannerHost isSignedIn={sessionView !== null} />
        </AdsSessionProvider>
      </body>
    </html>
  );
}
