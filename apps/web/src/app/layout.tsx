import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import { LaunchAnnouncementBar } from "@/components/layout/announcementBar";
import { SiteFooterWithGiantWordmark } from "@/components/layout/siteFooter";
import { SiteHeaderWithFloatingNavigation } from "@/components/layout/siteHeader";
import { siteConfig } from "@/lib/siteConfig.config";

import "./globals.css";

const interFont = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: "Zudomart — Shop the sellers you already watch",
    template: "%s · Zudomart",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: ["Zudomart", "Nigeria marketplace", "social commerce", "live shopping", "escrow", "buy online Nigeria", "sell online Nigeria"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_NG",
    siteName: siteConfig.name,
    title: "Zudomart — Shop the sellers you already watch",
    description: siteConfig.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zudomart — Shop the sellers you already watch",
    description: siteConfig.description,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#2043F5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-NG" className={interFont.variable}>
      <body>
        <a href="#main-content" className="skipToContentLink">
          Skip to content
        </a>
        <LaunchAnnouncementBar />
        <SiteHeaderWithFloatingNavigation />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <SiteFooterWithGiantWordmark />
      </body>
    </html>
  );
}
