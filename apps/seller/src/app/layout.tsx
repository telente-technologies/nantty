import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { SellerSessionProvider } from "@/components/session/sellerSessionProvider";
import { ToastProvider } from "@/components/ui/toastProvider";
import { dashboardProductName, readPublicSiteUrl } from "@/config/siteMetadata.config";
import { buildSellerSessionViewFromCookies, readCsrfTokenForCookies } from "@/server/sellerSessionView.service";

import "./globals.css";

const interFont = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const receiptFont = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--font-receipt", weight: ["400", "600"] });

export const metadata: Metadata = {
  metadataBase: new URL(readPublicSiteUrl()),
  title: { default: dashboardProductName, template: `%s · ${dashboardProductName}` },
  description: "Run your Zudomart store: point of sale, stock, orders, customers, payouts and ads in one place.",
  applicationName: dashboardProductName,
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
  openGraph: { type: "website", siteName: dashboardProductName, title: dashboardProductName, url: "/", locale: "en_NG" },
  icons: { icon: "/icons/appIcon.svg" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#2043F5",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const sessionView = buildSellerSessionViewFromCookies(cookieStore);
  const csrfToken = readCsrfTokenForCookies(cookieStore);
  return (
    <html lang="en-NG" className={`${interFont.variable} ${receiptFont.variable}`}>
      <body>
        <a href="#main-content" className="skipToContentLink">
          Skip to content
        </a>
        <SellerSessionProvider initialSessionView={sessionView} csrfToken={csrfToken}>
          <ToastProvider>{children}</ToastProvider>
        </SellerSessionProvider>
      </body>
    </html>
  );
}
