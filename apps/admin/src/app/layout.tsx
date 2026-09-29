import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { adminProductName } from "@/config/siteMetadata.config";

import "./globals.css";

const interFont = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const monoFont = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--font-mono-face", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: adminProductName, template: `%s · ${adminProductName}` },
  description: "Internal administration console for the Zudomart platform.",
  applicationName: adminProductName,
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
  icons: { icon: "/icons/adminAppIcon.svg" },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#070b24",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  await connection();
  return (
    <html lang="en-NG" className={`${interFont.variable} ${monoFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
