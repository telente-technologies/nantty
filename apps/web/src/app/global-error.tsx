"use client";

import { GlobalErrorScreen, ThemeInitScript } from "@nantty/web-kit";

import { marketingErrorConfig } from "@/components/errors/errorExperience.provider";

import "./globals.css";

export default function GlobalError({ error, retry }: { readonly error: Error & { readonly digest?: string }; readonly retry: () => void }) {
  return (
    <html lang="en-NG" suppressHydrationWarning>
      <head>
        <title>Nantty hit a problem</title>
        <ThemeInitScript />
      </head>
      <body>
        <GlobalErrorScreen error={error} retry={retry} config={marketingErrorConfig} />
      </body>
    </html>
  );
}
