import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { ThemeInitScript, ThemeProvider, themeViewport } from "@nantty/web-kit";

import { readPublicSiteUrl } from "@/config/site.config";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(readPublicSiteUrl()),
  title: { default: "Nantty API Sandbox", template: "%s · Nantty Sandbox" },
  description: "A clearly isolated environment for testing Nantty API integrations.",
  applicationName: "Nantty API Sandbox",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/nantty-icon.png", apple: "/brand/nantty-icon.png" },
};

export const viewport: Viewport = { ...themeViewport, width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-NG" suppressHydrationWarning>
      <head><ThemeInitScript /></head>
      <body><ThemeProvider initialPreference="system">{children}</ThemeProvider></body>
    </html>
  );
}
