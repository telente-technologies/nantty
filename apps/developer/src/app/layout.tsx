import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { ThemeInitScript, ThemeProvider, themeViewport } from "@nantty/web-kit";

import { readPublicSiteUrl } from "@/config/site.config";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(readPublicSiteUrl()),
  title: { default: "Nantty Developers", template: "%s · Nantty Developers" },
  description: "Developer documentation and business integration management for Nantty.",
  applicationName: "Nantty Developer Portal",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/nantty-icon.png", apple: "/brand/nantty-icon.png" },
};

export const viewport: Viewport = { ...themeViewport, width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en-NG" suppressHydrationWarning>
      <head><ThemeInitScript nonce={nonce} /></head>
      <body><ThemeProvider initialPreference="system">{children}</ThemeProvider></body>
    </html>
  );
}
