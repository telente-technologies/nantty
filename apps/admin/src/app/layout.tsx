import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { connection } from "next/server";
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";

import { ConnectionStatus, ThemeInitScript, parseThemePreference, readHtmlThemeAttribute, themeCookieName, themeViewport } from "@zudomart/web-kit";

import { ConsentBannerHost } from "@/components/privacy/consentBannerHost";
import { AppThemeProvider } from "@/components/theme/appThemeProvider";
import { buildAdminSessionViewFromCookies } from "@/server/adminSessionView.service";

import { adminProductName } from "@/config/siteMetadata.config";

import { AdminErrorExperienceProvider } from "@/components/errors/errorExperience.provider";

import "./globals.css";

const interFont = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const monoFont = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--font-mono-face", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: adminProductName, template: `%s · ${adminProductName}` },
  description: "Internal administration console for the Zudomart platform.",
  applicationName: adminProductName,
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/brand/favicon.ico", sizes: "48x48" }, { url: "/brand/icon.svg", type: "image/svg+xml" }], apple: "/brand/appleTouchIcon.png" },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  ...themeViewport,
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  await connection();
  const cookieStore = await cookies();
  const isSignedIn = buildAdminSessionViewFromCookies(cookieStore) !== null;
  const themePreference = parseThemePreference(cookieStore.get(themeCookieName)?.value);
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en-NG" className={`${interFont.variable} ${monoFont.variable}`} data-theme={readHtmlThemeAttribute(themePreference)} suppressHydrationWarning>
      <head>
        <ThemeInitScript nonce={nonce} />
      </head>
      <body>
        <ConnectionStatus />
        <AppThemeProvider initialPreference={themePreference} isSignedIn={isSignedIn}>
          <AdminErrorExperienceProvider>{children}</AdminErrorExperienceProvider>
          <ConsentBannerHost isSignedIn={isSignedIn} />
        </AppThemeProvider>
      </body>
    </html>
  );
}
